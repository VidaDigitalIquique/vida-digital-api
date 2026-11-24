"""
Tests de integracion de la reconciliacion en sync_winfac_neon (s10f-2, D13/D14).
Ejecutar: python -m unittest discover -s sync-neon -p "test_*.py" -v

No tocan DATABASE_URL ni ningun DBF real: dbfread se reemplaza por una tabla
falsa y las conexiones son dobles en memoria. El import del sincronizador
configura logging y crea logs/ (requisito del contrato); los tests aislan ese
efecto para no ensuciar el host.
"""
import logging
import os
import shutil
import sys
import unittest
from contextlib import ExitStack
from unittest.mock import MagicMock, patch

# dbfread no esta instalado en el entorno de pruebas: se mockea antes del import.
sys.modules.setdefault("dbfread", MagicMock())

sys.path.insert(0, os.path.dirname(__file__))

import reconciliacion as R  # noqa: E402

# Import aislado: no configura el logger raiz, no crea logs/, no lee .env.
with patch("logging.basicConfig") as _log_config, \
        patch("dotenv.load_dotenv"), \
        patch("logging.FileHandler"), patch("logging.StreamHandler"), \
        patch.object(os, "makedirs"), patch.object(os, "remove"), \
        patch.object(shutil, "copy"):
    import sync_winfac_neon as sync  # noqa: E402

class FakeDBF:
    """Iterador de registros como los entrega dbfread (claves en mayuscula)."""

    def __init__(self, records, error_after=None):
        self.records = records
        self.error_after = error_after

    def __iter__(self):
        for i, record in enumerate(self.records):
            if self.error_after is not None and i >= self.error_after:
                raise RuntimeError("DBF truncado a mitad de lectura")
            yield record


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn
        self._una = None
        self.rowcount = -1

    def execute(self, sql, params=None):
        self.conn.sentencias.append(sql)
        if "count(*)" in sql:
            self._una = (self.conn.candidatos,)
        if sql.lstrip().startswith("DELETE"):
            self.rowcount = self.conn.candidatos

    def fetchone(self):
        return self._una

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class FakeConn:
    def __init__(self, candidatos=0):
        self.sentencias = []
        self.candidatos = candidatos
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def registros(*items):
    return [{"KNUMFOLI": f, "KDOCITEM": d, "TOTALREA": t}
            for f, d, t in items]


def correr(conn, records, schema="vida", tabla="itemdcto", env=None,
           error_after=None, firma=None):
    """Ejecuta sync_tabla con DBF falso y registra los UPSERT/DELETE emitidos."""
    valores = []

    def fake_execute_values(cur, sql, values, page_size=500):
        valores.append((sql, values))

    entorno = {"SYNC_DELETE_ENABLED": "false", "SYNC_DELETE_MAX_ROWS": "100"}
    entorno.update(env or {})
    with ExitStack() as pila:
        pila.enter_context(
            patch.object(sync, "DBF",
                         lambda *a, **k: FakeDBF(records, error_after)))
        pila.enter_context(patch.object(sync, "execute_values",
                                        fake_execute_values))
        pila.enter_context(patch.object(R, "execute_values",
                                        fake_execute_values))
        pila.enter_context(patch.dict(os.environ, entorno))
        if firma is not None:
            pila.enter_context(patch.object(sync, "_firma_archivo", firma))
        res = sync.sync_tabla(conn, schema, tabla, sync.TABLAS[tabla],
                              "X:/fake.dbf")
    return res, valores


class TestLecturaDBF(unittest.TestCase):
    """Normalizacion de KDOCITEM en la lectura del DBF."""

    def leer(self, records):
        with patch.object(sync, "DBF", lambda *a, **k: FakeDBF(records)):
            return sync.read_dbf("X:/fake.dbf", ["knumfoli", "kdocitem"])

    def test_espacios_a_ambos_lados_se_recortan(self):
        rows = self.leer(registros(("000812", "  1", 10),
                                   ("000812", "1  ", 20)))
        self.assertEqual([r["kdocitem"] for r in rows], ["1", "1"])

    def test_ceros_iniciales_se_preservan(self):
        rows = self.leer(registros(("000812", "001", 10)))
        self.assertEqual(rows[0]["kdocitem"], "001")

    def test_pk_vacia_queda_en_none(self):
        rows = self.leer(registros(("000812", "   ", 10)))
        self.assertIsNone(rows[0]["kdocitem"])

    def test_excepcion_a_mitad_descarta_todo(self):
        with patch.object(
                sync, "DBF",
                lambda *a, **k: FakeDBF(registros(("000812", "1", 10),
                                                  ("000812", "2", 20)),
                                        error_after=1)):
            rows = sync.read_dbf("X:/fake.dbf", ["knumfoli", "kdocitem"])
        self.assertEqual(rows, [])


class TestImportAislado(unittest.TestCase):

    def test_al_importar_configura_logs_pero_no_escribe_archivos(self):
        self.assertTrue(_log_config.called)
        handlers = _log_config.call_args.kwargs.get("handlers", [])
        self.assertEqual(len(handlers), 2)
        self.assertNotIsInstance(handlers[0], logging.FileHandler)


class TestIntegracionMotor(unittest.TestCase):
    """sync_tabla debe usar el motor de reconciliacion solo en los destinos."""

    def test_itemdcto_upsert_sin_borrado_con_flag_apagado(self):
        conn = FakeConn(candidatos=5)
        res, valores = correr(conn, registros(("000812", "  1", 10)))
        sql = " ".join(conn.sentencias)
        self.assertEqual(res, 1)
        self.assertIn("pg_advisory_xact_lock", sql)
        self.assertIn("rea_pk", sql)
        self.assertIn("ON CONFLICT", valores[0][0])
        self.assertFalse(any(s.lstrip().startswith("DELETE")
                             for s in conn.sentencias))
        self.assertEqual(conn.commits, 1)

    def test_itemdcto_borra_dentro_del_limite(self):
        conn = FakeConn(candidatos=2)
        res, _ = correr(conn, registros(("000812", "1", 10)),
                        env={"SYNC_DELETE_ENABLED": "true"})
        self.assertEqual(res, 1)
        self.assertTrue(any(s.lstrip().startswith("DELETE")
                            for s in conn.sentencias))
        self.assertEqual(conn.commits, 1)

    def test_pk_vacia_no_escribe(self):
        conn = FakeConn(candidatos=5)
        res, valores = correr(conn, registros(("000812", "   ", 10)),
                              env={"SYNC_DELETE_ENABLED": "true"})
        self.assertEqual(res, 0)
        self.assertEqual(valores, [])
        self.assertEqual(conn.commits, 0)
        self.assertFalse(any(s.lstrip().startswith("DELETE")
                             for s in conn.sentencias))

    def test_lectura_incompleta_no_escribe(self):
        conn = FakeConn(candidatos=5)
        res, valores = correr(conn, registros(("000812", "1", 10),
                                              ("000812", "2", 20)),
                              env={"SYNC_DELETE_ENABLED": "true"},
                              error_after=1)
        self.assertEqual(res, 0)
        self.assertEqual(valores, [])
        self.assertEqual(conn.commits, 0)
        self.assertEqual(conn.rollbacks, 1)

    def test_archivo_cambiado_no_escribe(self):
        firmas = iter(["a", "b"])
        conn = FakeConn(candidatos=5)
        res, valores = correr(conn, registros(("000812", "1", 10)),
                              env={"SYNC_DELETE_ENABLED": "true"},
                              firma=lambda path: next(firmas))
        self.assertEqual(res, 0)
        self.assertEqual(valores, [])
        self.assertEqual(conn.commits, 0)

    def test_movidcto_usa_pk_de_un_solo_campo(self):
        conn = FakeConn(candidatos=0)
        res, valores = correr(conn, [{"KNUMFOLI": "000812", "TIPOMOVI": "N"}],
                              tabla="movidcto")
        self.assertEqual(res, 1)
        self.assertIn("ON CONFLICT (knumfoli)", valores[0][0])
        self.assertNotIn("kdocitem", " ".join(conn.sentencias))


class TestRegresionOtrasTablas(unittest.TestCase):

    def test_clientes_conserva_el_flujo_upsert_simple(self):
        conn = FakeConn(candidatos=0)
        records = [{"KCODCLIE": "C1", "NOMBRESS": "Cliente Uno"}]
        res, valores = correr(conn, records, tabla="clientes")
        sql = " ".join(conn.sentencias)
        self.assertEqual(res, 1)
        self.assertNotIn("pg_advisory_xact_lock", sql)
        self.assertNotIn("rea_pk", sql)
        self.assertIn("ON CONFLICT", valores[0][0])
        self.assertEqual(conn.commits, 1)

    def test_tabla_vacia_no_escribe(self):
        conn = FakeConn()
        res, valores = correr(conn, [], tabla="clientes")
        self.assertEqual(res, 0)
        self.assertEqual(valores, [])
        self.assertEqual(conn.commits, 0)


if __name__ == "__main__":
    unittest.main()
