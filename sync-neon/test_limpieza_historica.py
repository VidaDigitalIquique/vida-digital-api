"""
Tests de la limpieza historica D13/D14 (s10f-3).

Ejecutar: python -m unittest discover -s sync-neon -p "test_*.py" -v

No usan dbfread ni se conectan a ninguna base: inyectan lector, campos y
conexion falsos. Nunca leen DATABASE_URL.
"""
import contextlib
import importlib.util
import io
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import reconciliacion as R  # noqa: E402

RUTA = os.path.join(os.path.dirname(__file__), "..", "scripts",
                    "limpiar_winfac_historico.py")
_spec = importlib.util.spec_from_file_location("limpiar_historico", RUTA)
L = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(L)

FILAS_DBF = [
    {"knumfoli": "002499", "kdocitem": " 1", "totalrea": 100},
    {"knumfoli": "002499", "kdocitem": "2", "totalrea": 50},
]


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn
        self._all = []
        self._una = None

    def execute(self, sql, params=None):
        low = sql.lower()
        self.conn.sql.append(sql)
        if self.conn.readonly and low.lstrip().startswith(
                ("insert", "update", "delete", "create", "drop")):
            raise AssertionError(f"escritura con conexion readonly: {sql}")
        if "information_schema" in low:
            self._all = [(c,) for c in self.conn.columnas]
        elif "totalrea" in low:
            self._all = self.conn.lineas_item
        elif "val_rea" in low:
            self._all = self.conn.lineas_mov
        else:
            self._all = self.conn.pks

    def fetchall(self):
        return self._all

    def fetchone(self):
        return self._una

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeConn:
    def __init__(self, pks=(), lineas_item=(), lineas_mov=(),
                 columnas=("knumfoli", "kdocitem", "totalrea")):
        self.pks = list(pks)
        self.lineas_item = list(lineas_item)
        self.lineas_mov = list(lineas_mov)
        self.columnas = list(columnas)
        self.sql = []
        self.readonly = False
        self.cerrada = False

    def set_session(self, readonly=False):
        self.readonly = readonly

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        self.cerrada = True


def correr(conn, argv, env=None, leer=lambda path: FILAS_DBF,
           campos=lambda path: ["knumfoli", "kdocitem", "totalrea"]):
    urls = []

    def conectar(url):
        urls.append(url)
        return conn

    salida = io.StringIO()
    with contextlib.redirect_stdout(salida):
        rc = L.main(argv, env=env or {}, conectar=conectar, leer=leer,
                    campos=campos)
    return rc, salida.getvalue(), urls, conn


class TestDestino(unittest.TestCase):

    def test_sin_test_database_url_aborta_sin_conectar(self):
        rc, out, urls, conn = correr(
            FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto"],
            env={"DATABASE_URL": "postgresql://produccion"})
        self.assertNotEqual(rc, 0)
        self.assertEqual(urls, [])
        self.assertIn("TEST_DATABASE_URL", out)

    def test_usa_test_database_url_por_defecto(self):
        rc, out, urls, conn = correr(
            FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto"],
            env={"DATABASE_URL": "postgresql://produccion",
                 "TEST_DATABASE_URL": "postgresql://pruebas"})
        self.assertEqual(rc, 0)
        self.assertEqual(urls, ["postgresql://pruebas"])

    def test_database_env_explicito_permite_produccion(self):
        rc, out, urls, conn = correr(
            FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto",
                         "--database-env", "DATABASE_URL"],
            env={"DATABASE_URL": "postgresql://produccion"})
        self.assertEqual(rc, 0)
        self.assertEqual(urls, ["postgresql://produccion"])
        self.assertIn("produccion", out.lower())


class TestDryRun(unittest.TestCase):

    def test_dry_run_solo_lee(self):
        conn = FakeConn(pks=[("002499", "1"), ("002499", "2")])
        rc, out, urls, conn = correr(
            conn, ["--empresa", "vida", "--tabla", "itemdcto"],
            env={"TEST_DATABASE_URL": "postgresql://pruebas"})
        self.assertEqual(rc, 0)
        self.assertTrue(conn.readonly)
        self.assertTrue(conn.cerrada)
        self.assertFalse(any(s.lower().lstrip().startswith(
            ("insert", "update", "delete", "create", "drop"))
            for s in conn.sql))

    def test_dry_run_muestra_conteos(self):
        conn = FakeConn(pks=[("002499", "1"), ("002499", "2"),
                             ("002499", "9")])
        rc, out, urls, conn = correr(
            conn, ["--empresa", "vida", "--tabla", "itemdcto"],
            env={"TEST_DATABASE_URL": "postgresql://pruebas"})
        self.assertEqual(rc, 0)
        self.assertIn("vida.itemdcto", out)
        self.assertIn("ausentes", out.lower())
        self.assertIn("1", out)  # una PK de Neon ausente del DBF

    def test_dbf_invalido_aborta_sin_escribir(self):
        def leer(path):
            raise RuntimeError("dbf ilegible")
        rc, out, urls, conn = correr(
            FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto"],
            env={"TEST_DATABASE_URL": "postgresql://pruebas"}, leer=leer)
        self.assertNotEqual(rc, 0)
        self.assertIn("dbf", out.lower())
        self.assertTrue(conn.cerrada)


class TestMetricas(unittest.TestCase):

    def test_varias_lineas_no_multiplican_cabeceras(self):
        lineas = [("A", "1", 100), ("A", "2", 100), ("A", "3", 100),
                  ("B", "1", 50), ("B", "2", 50)]
        movs = [("A", 250, "2026-01-10"), ("B", 200, "2025-05-05"),
                ("C", 10, "2026-02-01")]
        m = L.calcular_metricas(set(), frozenset(), lineas, movs)
        self.assertEqual(m["notas_sobre_rea"], 1)
        self.assertEqual(m["notas_sobre_rea_2026"], 1)

    def test_espacios_y_duplicados_por_trim(self):
        lineas = [("000812", "  1", 10), ("000812", "1", 10),
                  ("000812", "2", 10)]
        m = L.calcular_metricas(set(), frozenset(), lineas, [])
        self.assertEqual(m["kdocitem_con_espacios"], 1)
        self.assertEqual(m["grupos_duplicados"], 1)
        self.assertEqual(m["filas_excedentes"], 1)

    def test_pks_ausentes_compara_neon_sin_recortar(self):
        neon = {("1", "  1"), ("1", "1"), ("1", "2"), ("1", "3")}
        snap = frozenset({("1", "1"), ("1", "2")})
        m = L.calcular_metricas(neon, snap, [], [])
        self.assertEqual(m["pks_ausentes"], 2)


class TestApply(unittest.TestCase):

    def test_apply_exige_limite_explicito(self):
        rc, out, urls, conn = correr(
            FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto",
                         "--apply"],
            env={"TEST_DATABASE_URL": "postgresql://pruebas"})
        self.assertNotEqual(rc, 0)
        self.assertEqual(urls, [])
        self.assertIn("max-delete-rows", out)

    def test_apply_reutiliza_el_motor_con_el_limite(self):
        conn = FakeConn(columnas=("knumfoli", "kdocitem", "totalrea"))
        resultado = R.Resultado("OK", "", upsert=2, candidatos=3, limite=20000,
                                borrados=3)
        with mock.patch.object(L.R, "reconciliar_tabla",
                               return_value=resultado) as motor:
            rc, out, urls, conn = correr(
                conn, ["--empresa", "sanjh", "--tabla", "itemdcto",
                       "--apply", "--max-delete-rows", "20000"],
                env={"TEST_DATABASE_URL": "postgresql://pruebas"})
        self.assertEqual(rc, 0)
        self.assertTrue(motor.called)
        args, kwargs = motor.call_args
        self.assertEqual(args[1:3], ("sanjh", "itemdcto"))
        self.assertEqual(kwargs["config"], R.ConfigBorrado(True, 20000))
        self.assertIn("borrados=3", out.lower())

    def test_apply_idempotente_segunda_corrida_sin_borrados(self):
        primera = R.Resultado("OK", "", upsert=2, candidatos=2, limite=100,
                              borrados=2)
        segunda = R.Resultado("OK", "", upsert=2, candidatos=0, limite=100,
                              borrados=0)
        with mock.patch.object(L.R, "reconciliar_tabla",
                               side_effect=[primera, segunda]):
            rc1, out1, _, _ = correr(
                FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto",
                             "--apply", "--max-delete-rows", "100"],
                env={"TEST_DATABASE_URL": "postgresql://pruebas"})
            rc2, out2, _, _ = correr(
                FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto",
                             "--apply", "--max-delete-rows", "100"],
                env={"TEST_DATABASE_URL": "postgresql://pruebas"})
        self.assertEqual((rc1, rc2), (0, 0))
        self.assertIn("borrados=2", out1.lower())
        self.assertIn("borrados=0", out2.lower())

    def test_apply_limite_excedido_muestra_motivo(self):
        resultado = R.Resultado("BORRADO_OMITIDO", "limite_excedido (5 > 1)",
                                upsert=2, candidatos=5, limite=1)
        with mock.patch.object(L.R, "reconciliar_tabla",
                               return_value=resultado):
            rc, out, urls, conn = correr(
                FakeConn(), ["--empresa", "vida", "--tabla", "itemdcto",
                             "--apply", "--max-delete-rows", "1"],
                env={"TEST_DATABASE_URL": "postgresql://pruebas"})
        self.assertEqual(rc, 0)
        self.assertIn("BORRADO_OMITIDO", out)
        self.assertIn("limite_excedido", out)


if __name__ == "__main__":
    unittest.main()
