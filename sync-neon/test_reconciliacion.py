"""
Tests del motor de reconciliacion (s10f-1).
Ejecutar: python -m unittest discover -s sync-neon -p "test_*.py" -v

No tocan DATABASE_URL. El test de integracion es opcional y solo corre si
TEST_DATABASE_URL esta exportada en el entorno.
"""
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))

import reconciliacion as R  # noqa: E402

COLUMNAS = ["knumfoli", "kdocitem", "totalrea"]
PK = ("knumfoli", "kdocitem")


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn
        self._una = None
        self.rowcount = -1

    def execute(self, sql, params=None):
        self.conn.sentencias.append(sql)
        if self.conn.fail == "count" and "count(*)" in sql:
            raise RuntimeError("count boom")
        if self.conn.fail == "delete" and sql.lstrip().startswith("DELETE"):
            raise RuntimeError("delete boom")
        if "count(*)" in sql:
            self._una = (self.conn.candidatos,)
        if sql.lstrip().startswith("DELETE"):
            self.rowcount = self.conn.candidatos

    def fetchone(self):
        return self._una

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeConn:
    def __init__(self, candidatos=0, fail=None):
        self.sentencias = []
        self.candidatos = candidatos
        self.fail = fail
        self.commits = 0
        self.rollbacks = 0
        self.valores = []

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def instalar_execute_values(conn):
    """Reemplaza psycopg2.extras.execute_values y registra sus llamadas."""
    def fake(cur, sql, values, page_size=500):
        conn.valores.append((sql, values))
        if conn.fail == "upsert" and "ON CONFLICT" in sql:
            raise RuntimeError("upsert boom")
    return patch.object(R, "execute_values", fake)


def filas(*pares):
    return [
        {"knumfoli": f, "kdocitem": d, "totalrea": t}
        for f, d, t in pares
    ]


def correr(conn, rows, config=None, firma=None):
    with instalar_execute_values(conn):
        return R.reconciliar_tabla(
            conn, "vida", "itemdcto", COLUMNAS, PK,
            lambda: rows, firma_fn=firma,
            config=config or R.ConfigBorrado(False, R.LIMITE_DEFAULT),
        )


class TestConfig(unittest.TestCase):

    def test_default_apagado_y_limite_100(self):
        cfg = R.config_borrado({})
        self.assertFalse(cfg.habilitado)
        self.assertEqual(cfg.limite, 100)

    def test_activado(self):
        for valor in ("true", "1", "TRUE", "yes"):
            self.assertTrue(R.config_borrado(
                {"SYNC_DELETE_ENABLED": valor}).habilitado)

    def test_limite_invalido_bloquea(self):
        for valor in ("abc", "-1", "10.5", ""):
            cfg = R.config_borrado({"SYNC_DELETE_ENABLED": "true",
                                    "SYNC_DELETE_MAX_ROWS": valor})
            self.assertFalse(cfg.habilitado)
            self.assertTrue(cfg.advertencia)

    def test_cero_es_valido(self):
        cfg = R.config_borrado({"SYNC_DELETE_ENABLED": "true",
                                "SYNC_DELETE_MAX_ROWS": "0"})
        self.assertTrue(cfg.habilitado)
        self.assertEqual(cfg.limite, 0)


class TestDestinos(unittest.TestCase):

    def test_lista_cerrada(self):
        self.assertEqual(R.destino_pk("vida", "itemdcto"), PK)
        self.assertEqual(R.destino_pk("sanjh", "itemdcto"), PK)
        self.assertEqual(R.destino_pk("vida", "movidcto"), ("knumfoli",))
        self.assertEqual(R.destino_pk("sanjh", "movidcto"), ("knumfoli",))
        self.assertIsNone(R.destino_pk("vida", "inb"))

    def test_reconciliar_destino_rechaza_fuera_de_lista(self):
        conn = FakeConn()
        with instalar_execute_values(conn):
            res = R.reconciliar_destino(
                conn, "vida", "inb", COLUMNAS, lambda: filas(("1", "1", 1)))
        self.assertEqual(res.estado, "DESTINO_NO_PERMITIDO")
        self.assertEqual(conn.sentencias, [])
        self.assertEqual(conn.commits, 0)


class TestSnapshot(unittest.TestCase):

    def test_espacios_convergen_a_la_misma_pk(self):
        snap = R.validar_snapshot(filas((" 1", "  1", 10)), PK)
        self.assertEqual(len(snap.filas), 1)
        self.assertEqual(list(snap.claves), [("1", "1")])

    def test_ceros_iniciales_no_se_convierten(self):
        snap = R.validar_snapshot(filas(("1", "001", 10), ("1", "1", 20)), PK)
        self.assertEqual(len(snap.claves), 2)

    def test_pk_nula_o_vacia_invalida(self):
        for valor in (None, "", "   "):
            with self.assertRaises(R.SnapshotInvalido):
                R.validar_snapshot(filas(("1", valor, 10)), PK)

    def test_duplicado_identico_se_consolida(self):
        snap = R.validar_snapshot(filas(("1", "1", 10), ("1", " 1", 10)), PK)
        self.assertEqual(len(snap.filas), 1)

    def test_duplicado_con_datos_distintos_invalida(self):
        with self.assertRaises(R.SnapshotInvalido):
            R.validar_snapshot(filas(("1", "1", 10), ("1", "1", 99)), PK)

    def test_vacio_invalida(self):
        with self.assertRaises(R.SnapshotInvalido):
            R.validar_snapshot([], PK)


class TestBorrado(unittest.TestCase):

    def test_flag_apagado_no_borra_pero_si_upserta(self):
        conn = FakeConn(candidatos=5)
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(False, 100))
        self.assertEqual(res.estado, "BORRADO_OMITIDO")
        self.assertEqual(res.candidatos, 5)
        self.assertEqual(conn.commits, 1)
        upserts = [v for s, v in conn.valores if "ON CONFLICT" in s]
        self.assertEqual(len(upserts), 1)
        self.assertFalse(any(s.lstrip().startswith("DELETE")
                             for s in conn.sentencias))

    def test_dentro_del_limite_borra(self):
        conn = FakeConn(candidatos=3)
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "OK")
        self.assertEqual(res.borrados, 3)
        self.assertTrue(any(s.lstrip().startswith("DELETE")
                            for s in conn.sentencias))

    def test_exactamente_el_limite_borra(self):
        conn = FakeConn(candidatos=100)
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "OK")
        self.assertEqual(res.borrados, 100)

    def test_limite_mas_uno_no_borra(self):
        conn = FakeConn(candidatos=101)
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "BORRADO_OMITIDO")
        self.assertIn("limite", res.motivo)
        self.assertEqual(conn.commits, 1)
        self.assertFalse(any(s.lstrip().startswith("DELETE")
                             for s in conn.sentencias))

    def test_limite_cero_sin_candidatos_ok(self):
        conn = FakeConn(candidatos=0)
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 0))
        self.assertEqual(res.estado, "OK")
        self.assertEqual(res.borrados, 0)

    def test_limite_cero_con_candidatos_omite(self):
        conn = FakeConn(candidatos=1)
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 0))
        self.assertEqual(res.estado, "BORRADO_OMITIDO")

    def test_comparacion_neon_no_recorta(self):
        conn = FakeConn(candidatos=2)
        correr(conn, filas(("1", "1", 10)),
               config=R.ConfigBorrado(True, 100))
        sql = " ".join(conn.sentencias).lower()
        self.assertNotIn("trim(", sql)
        self.assertNotIn("btrim(", sql)
        self.assertIn("::text", sql)

    def test_no_toca_otros_destinos(self):
        conn = FakeConn(candidatos=1)
        correr(conn, filas(("1", "1", 10)),
               config=R.ConfigBorrado(True, 100))
        sql = " ".join(conn.sentencias).lower()
        self.assertNotIn("sanjh", sql)
        self.assertNotIn("movidcto", sql)
        self.assertNotIn("inb", sql)


class TestLecturaYFallos(unittest.TestCase):

    def test_lectura_incompleta_no_escribe(self):
        def leer():
            raise RuntimeError("mitad de iteracion")
        conn = FakeConn(candidatos=1)
        with instalar_execute_values(conn):
            res = R.reconciliar_tabla(
                conn, "vida", "itemdcto", COLUMNAS, PK, leer,
                config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "LECTURA_INVALIDA")
        self.assertEqual(conn.valores, [])
        self.assertEqual(conn.rollbacks, 1)
        self.assertEqual(conn.commits, 0)

    def test_snapshot_vacio_no_escribe(self):
        conn = FakeConn(candidatos=1)
        res = correr(conn, [], config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "SNAPSHOT_INVALIDO")
        self.assertEqual(conn.valores, [])
        self.assertEqual(conn.commits, 0)

    def test_pk_invalida_no_escribe(self):
        conn = FakeConn(candidatos=1)
        res = correr(conn, filas(("1", None, 10)),
                     config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "SNAPSHOT_INVALIDO")
        self.assertEqual(conn.valores, [])

    def test_archivo_cambiado_omite(self):
        firmas = iter(["a", "b"])
        conn = FakeConn(candidatos=5)
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 100),
                     firma=lambda: next(firmas))
        self.assertEqual(res.estado, "ARCHIVO_CAMBIO")
        self.assertEqual(conn.valores, [])
        self.assertEqual(conn.commits, 0)

    def test_bloqueo_antes_de_leer(self):
        conn = FakeConn(candidatos=0)
        visto = {}

        def leer():
            visto["bloqueado"] = any(
                "pg_advisory_xact_lock" in s for s in conn.sentencias)
            return filas(("1", "1", 10))

        with instalar_execute_values(conn):
            R.reconciliar_tabla(
                conn, "vida", "itemdcto", COLUMNAS, PK, leer,
                config=R.ConfigBorrado(False, 100))
        self.assertTrue(visto.get("bloqueado"))

    def test_error_upsert_revierte(self):
        conn = FakeConn(candidatos=1, fail="upsert")
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "ERROR")
        self.assertEqual(conn.rollbacks, 1)
        self.assertEqual(conn.commits, 0)

    def test_error_delete_revierte(self):
        conn = FakeConn(candidatos=1, fail="delete")
        res = correr(conn, filas(("1", "1", 10)),
                     config=R.ConfigBorrado(True, 100))
        self.assertEqual(res.estado, "ERROR")
        self.assertEqual(conn.rollbacks, 1)
        self.assertEqual(conn.commits, 0)

    def test_segunda_corrida_idempotente(self):
        primera = FakeConn(candidatos=2)
        res1 = correr(primera, filas(("1", "1", 10)),
                      config=R.ConfigBorrado(True, 100))
        segunda = FakeConn(candidatos=0)
        res2 = correr(segunda, filas(("1", "1", 10)),
                      config=R.ConfigBorrado(True, 100))
        self.assertEqual(res1.estado, "OK")
        self.assertEqual(res2.estado, "OK")
        self.assertEqual(res2.borrados, 0)


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"),
                     "TEST_DATABASE_URL no definida en el entorno")
class TestIntegracion(unittest.TestCase):
    """Opcional: solo si TEST_DATABASE_URL esta exportada. Nunca DATABASE_URL."""

    def test_upsert_y_borrado_en_tabla_temporal(self):
        import psycopg2
        url = os.environ["TEST_DATABASE_URL"]
        self.assertNotEqual(url, os.environ.get("DATABASE_URL"))
        conn = psycopg2.connect(url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "CREATE TEMP TABLE rea_it (knumfoli text, kdocitem text,"
                    " totalrea integer)")
                cur.execute("INSERT INTO rea_it VALUES ('1','9',90)")
            conn.commit()
            rows = [{"knumfoli": "1", "kdocitem": "1", "totalrea": 10},
                    {"knumfoli": "1", "kdocitem": "2", "totalrea": 20}]
            res = R.reconciliar_tabla(
                conn, "pg_temp", "rea_it", COLUMNAS, PK, lambda: rows,
                config=R.ConfigBorrado(True, 100))
            self.assertEqual(res.estado, "OK")
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM rea_it")
                self.assertEqual(cur.fetchone()[0], 2)
            res2 = R.reconciliar_tabla(
                conn, "pg_temp", "rea_it", COLUMNAS, PK, lambda: rows,
                config=R.ConfigBorrado(True, 100))
            self.assertEqual(res2.estado, "OK")
            self.assertEqual(res2.borrados, 0)
        finally:
            try:
                with conn.cursor() as cur:
                    cur.execute("DROP TABLE IF EXISTS rea_it")
                conn.commit()
            finally:
                conn.close()


if __name__ == "__main__":
    unittest.main()
