"""
reconciliacion.py
=================
Motor compartido de reconciliacion DBF -> Neon (s10f, D13/D14).

Contrato: solo los destinos de DESTINOS se reconcilian (borrado de filas que ya
no existen en el DBF). El UPSERT nunca se bloquea por la configuracion de
borrado; el DELETE es opcional y conservador:

    SYNC_DELETE_ENABLED=false  (default)  -> nunca borra
    SYNC_DELETE_MAX_ROWS=100    (default) -> maximo absoluto por tabla/esquema

Un snapshot invalido (vacio, PK invalida, duplicado con datos distintos,
lectura fallida o archivo cambiado durante la lectura) no produce escrituras.
El UPSERT y el DELETE comparten una unica transaccion por destino.
"""

import os
import logging
import re
from dataclasses import dataclass

from psycopg2.extras import execute_values

LIMITE_DEFAULT = 100
LOCK_TIMEOUT = "10s"

# Lista cerrada de destinos reconciliados: (schema, tabla) -> PK.
DESTINOS = {
    ("vida", "itemdcto"): ("knumfoli", "kdocitem"),
    ("sanjh", "itemdcto"): ("knumfoli", "kdocitem"),
    ("vida", "movidcto"): ("knumfoli",),
    ("sanjh", "movidcto"): ("knumfoli",),
}

_IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")


class SnapshotInvalido(Exception):
    """El snapshot no es confiable: prohibido escribir o borrar."""


@dataclass(frozen=True)
class ConfigBorrado:
    habilitado: bool
    limite: int
    advertencia: str = None


@dataclass(frozen=True)
class Snapshot:
    filas: tuple      # filas normalizadas (dicts)
    claves: frozenset


@dataclass(frozen=True)
class Resultado:
    estado: str       # OK | BORRADO_OMITIDO | SNAPSHOT_INVALIDO | LECTURA_INVALIDA |
    #                   ARCHIVO_CAMBIO | DESTINO_NO_PERMITIDO | ERROR
    motivo: str = ""
    upsert: int = 0
    candidatos: int = 0
    limite: int = 0
    borrados: int = 0


def config_borrado(env=None) -> ConfigBorrado:
    """Lee la configuracion de borrado. Cualquier valor invalido lo desactiva."""
    env = os.environ if env is None else env
    activo = env.get("SYNC_DELETE_ENABLED", "false").strip().lower() in (
        "true", "1", "yes", "on")
    crudo = env.get("SYNC_DELETE_MAX_ROWS", str(LIMITE_DEFAULT)).strip()
    try:
        limite = int(crudo)
        if limite < 0:
            raise ValueError
    except (TypeError, ValueError):
        return ConfigBorrado(False, 0,
                             f"SYNC_DELETE_MAX_ROWS invalido: {crudo!r}")
    return ConfigBorrado(activo, limite)


def destino_pk(schema: str, tabla: str):
    """PK del destino si esta en la lista cerrada; None en otro caso."""
    return DESTINOS.get((schema, tabla))


def _norm(valor):
    if isinstance(valor, str):
        valor = valor.strip()
        return valor or None
    return valor


def _texto_pk(valor):
    valor = _norm(valor)
    return None if valor is None else str(valor)


def validar_snapshot(filas, pk_columns) -> Snapshot:
    """Normaliza y valida el snapshot completo antes de cualquier escritura."""
    if not filas:
        raise SnapshotInvalido("snapshot vacio")
    unicas = {}
    for fila in filas:
        normal = {}
        for col in pk_columns:
            texto = _texto_pk(fila.get(col))
            if texto is None:
                raise SnapshotInvalido(f"PK invalida en columna {col}")
            normal[col] = texto
        for col, valor in fila.items():
            if col not in pk_columns:
                normal[col] = _norm(valor)
        clave = tuple(normal[c] for c in pk_columns)
        previa = unicas.get(clave)
        if previa is None:
            unicas[clave] = normal
        elif previa != normal:
            raise SnapshotInvalido(
                f"PK duplicada con datos distintos: {clave}")
    return Snapshot(tuple(unicas.values()), frozenset(unicas))


def _ident(nombre: str) -> str:
    if not _IDENT.match(nombre):
        raise ValueError(f"Identificador SQL no permitido: {nombre!r}")
    return nombre


def reconciliar_destino(conn, schema: str, tabla: str, columnas, leer_fn,
                        firma_fn=None, config=None, log=None) -> Resultado:
    """Reconcilia un destino de la lista cerrada. Ver reconciliar_tabla."""
    pk = destino_pk(schema, tabla)
    if pk is None:
        return Resultado("DESTINO_NO_PERMITIDO",
                         f"{schema}.{tabla} no esta en la lista de reconciliacion")
    return reconciliar_tabla(conn, schema, tabla, columnas, pk, leer_fn,
                             firma_fn=firma_fn, config=config, log=log)


def reconciliar_tabla(conn, schema: str, tabla: str, columnas, pk_columns,
                      leer_fn, firma_fn=None, config=None,
                      log=None) -> Resultado:
    """UPSERT + DELETE opcional de un destino en una sola transaccion.

    Serializa con un advisory lock ANTES de leer el DBF. Si el snapshot no es
    valido no escribe nada. Si el flag/limite bloquea el borrado, conserva el
    UPSERT y devuelve BORRADO_OMITIDO con el motivo.
    """
    log = log or logging.getLogger(__name__)
    config = config or config_borrado()
    schema, tabla = _ident(schema), _ident(tabla)
    columnas = [_ident(c) for c in columnas]
    pk_columns = [_ident(c) for c in pk_columns]
    destino = f"{schema}.{tabla}"

    try:
        with conn.cursor() as cur:
            cur.execute(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT}'")
            cur.execute(
                "SELECT pg_advisory_xact_lock(hashtext(%s), hashtext(%s))",
                (schema, tabla))

            firma_inicial = firma_fn() if firma_fn else None
            try:
                filas = leer_fn()
            except Exception as e:
                conn.rollback()
                log.error(f"  {destino}: lectura invalida: {e}")
                return Resultado("LECTURA_INVALIDA", str(e))
            if firma_fn and firma_fn() != firma_inicial:
                conn.rollback()
                log.warning(f"  {destino}: archivo cambio durante la lectura")
                return Resultado("ARCHIVO_CAMBIO", "el archivo cambio durante la lectura")

            try:
                snapshot = validar_snapshot(filas, pk_columns)
            except SnapshotInvalido as e:
                conn.rollback()
                log.warning(f"  {destino}: snapshot invalido: {e}")
                return Resultado("SNAPSHOT_INVALIDO", str(e))

            update_cols = [c for c in columnas if c not in pk_columns]
            insert_sql = (
                f"INSERT INTO {destino} ({', '.join(columnas)}) VALUES %s "
                f"ON CONFLICT ({', '.join(pk_columns)}) DO UPDATE SET "
                + ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols))
            execute_values(cur, insert_sql,
                           [tuple(f[c] for c in columnas)
                            for f in snapshot.filas], page_size=500)

            cur.execute(
                f"CREATE TEMP TABLE rea_pk ({', '.join(c + ' text' for c in pk_columns)}) "
                "ON COMMIT DROP")
            execute_values(
                cur,
                f"INSERT INTO rea_pk ({', '.join(pk_columns)}) VALUES %s",
                list(snapshot.claves), page_size=500)

            condicion = " AND ".join(
                f"t.{c}::text = p.{c}" for c in pk_columns)
            cur.execute(
                f"SELECT count(*) FROM {destino} t LEFT JOIN rea_pk p "
                f"ON {condicion} WHERE p.{pk_columns[0]} IS NULL")
            candidatos = cur.fetchone()[0]

            motivo = None
            if not config.habilitado:
                motivo = "flag_apagado" if not config.advertencia else config.advertencia
            elif candidatos > config.limite:
                motivo = f"limite_excedido ({candidatos} > {config.limite})"

            borrados = 0
            if motivo is None and candidatos:
                existe = " AND ".join(
                    f"p.{c} = t.{c}::text" for c in pk_columns)
                cur.execute(
                    f"DELETE FROM {destino} t WHERE NOT EXISTS "
                    f"(SELECT 1 FROM rea_pk p WHERE {existe})")
                borrados = cur.rowcount if cur.rowcount and cur.rowcount > 0 \
                    else candidatos

        conn.commit()
        if motivo:
            log.warning(
                f"  BORRADO_OMITIDO {destino}: {motivo}; "
                f"candidatos={candidatos}, limite={config.limite}; "
                f"UPSERT conservado ({len(snapshot.filas)} filas)")
            return Resultado("BORRADO_OMITIDO", motivo,
                             len(snapshot.filas), candidatos, config.limite)
        log.info(f"  {destino}: upsert={len(snapshot.filas)}, "
                 f"borrados={borrados}, candidatos={candidatos}")
        return Resultado("OK", "", len(snapshot.filas), candidatos,
                         config.limite, borrados)
    except Exception as e:
        conn.rollback()
        log.error(f"  ERROR {destino}: {e}")
        return Resultado("ERROR", str(e), limite=config.limite)
