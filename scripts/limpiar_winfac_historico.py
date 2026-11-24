"""
limpiar_winfac_historico.py
===========================
Limpieza historica de D13/D14 (s10f-3). CLI separada del sincronizador.

    python scripts/limpiar_winfac_historico.py --empresa vida --tabla itemdcto
    python scripts/limpiar_winfac_historico.py --empresa vida --tabla itemdcto \
        --apply --max-delete-rows 20000

Sin --apply es un diagnostico de SOLO LECTURA: conteos, sin UPSERT, DELETE ni
tablas temporales. --apply reconstruye el snapshot y delega en
reconciliacion.reconciliar_tabla (lock, guardas, transaccion).

Destino por defecto: TEST_DATABASE_URL. Si no existe, aborta: NUNCA cae en
silencio a DATABASE_URL. Para produccion hay que pedirlo de forma explicita
con --database-env DATABASE_URL.
"""

import argparse
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "sync-neon"))

import reconciliacion as R  # noqa: E402

# Copia del mapa instalado (sync_winfac_neon.py). Se evita importarlo porque
# al importarse configura logs y carga dependencias que esta CLI no necesita.
EMPRESAS = {
    "sanjh": r"C:\red\newdesar\winfac_nna\Base",
    "vida": r"C:\red\newdesar\winfac_nna\VIDAD",
}
TABLAS = {"itemdcto": "itemdcto.dbf", "movidcto": "movidcto.dbf"}


def cargar_dbf(path):
    """Lee el DBF completo con dbfread. Una lectura fallida aborta todo."""
    from dbfread import DBF
    if not os.path.exists(path):
        raise RuntimeError(f"archivo DBF no encontrado: {path}")
    try:
        return [dict(r) for r in
                DBF(path, encoding="latin-1", ignore_missing_memofile=True)]
    except Exception as e:
        raise RuntimeError(f"no se pudo leer el DBF {path}: {e}") from e


def campos_dbf(path):
    """Nombres de campo del DBF en minusculas (sin recorrer filas)."""
    from dbfread import DBF
    tabla = DBF(path, encoding="latin-1", ignore_missing_memofile=True)
    return [c.lower() for c in tabla.field_names]


def _firma(path):
    st = os.stat(path)
    return (st.st_size, st.st_mtime)


def _pk_de(empresa, tabla):
    return R.destino_pk(empresa, tabla)


def _consultar(conn, sql, params=None):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def pks_neon(conn, schema, tabla, pk):
    """PK almacenadas tal cual (::text), sin recortar kdocitem."""
    cols = ", ".join(f"{c}::text" for c in pk)
    return {tuple(r) for r in
            _consultar(conn, f"SELECT {cols} FROM {schema}.{tabla}")}


def lineas_item(conn, schema, tabla):
    return _consultar(
        conn, f"SELECT knumfoli, kdocitem, totalrea FROM {schema}.{tabla}")


def lineas_mov(conn, schema):
    return _consultar(
        conn, "SELECT knumfoli, val_rea, fechadoc FROM "
              f"{schema}.movidcto")


def calcular_metricas(neon_pks, snap_claves, filas_item, filas_mov):
    """Metricas diagnosticas. Varias lineas por nota no multiplican cabeceras."""
    espacios = sum(1 for _, k, _ in filas_item
                   if isinstance(k, str) and k != k.strip())
    grupos = {}
    for knumfoli, kdocitem, _ in filas_item:
        clave = (knumfoli, (kdocitem or "").strip())
        grupos[clave] = grupos.get(clave, 0) + 1
    duplicados = sum(1 for n in grupos.values() if n > 1)
    excedentes = sum(n - 1 for n in grupos.values() if n > 1)

    totales, sobre, sobre_2026 = {}, 0, 0
    for knumfoli, _, totalrea in filas_item:
        totales[knumfoli] = totales.get(knumfoli, 0) + (totalrea or 0)
    for knumfoli, val_rea, fechadoc in filas_mov:
        if val_rea is not None and totales.get(knumfoli, 0) > val_rea:
            sobre += 1
            if str(fechadoc).startswith("2026"):
                sobre_2026 += 1
    return {
        "pks_neon": len(neon_pks),
        "pks_ausentes": len(neon_pks - snap_claves),
        "kdocitem_con_espacios": espacios,
        "grupos_duplicados": duplicados,
        "filas_excedentes": excedentes,
        "notas_sobre_rea": sobre,
        "notas_sobre_rea_2026": sobre_2026,
    }


def diagnosticar(conn, empresa, tabla, snap):
    print(f"== {empresa}.{tabla} ==")
    print(f"DBF: {len(snap.filas)} filas, {len(snap.claves)} PKs")
    pks = pks_neon(conn, empresa, tabla, _pk_de(empresa, tabla))
    filas = lineas_item(conn, empresa, tabla) if tabla == "itemdcto" else []
    movs = lineas_mov(conn, empresa) if tabla == "itemdcto" else []
    m = calcular_metricas(pks, snap.claves, filas, movs)
    print(f"Neon: {m['pks_neon']} PKs; ausentes del DBF: {m['pks_ausentes']}")
    if tabla == "itemdcto":
        print(f"kdocitem con espacios: {m['kdocitem_con_espacios']}")
        print(f"grupos duplicados por (knumfoli, trim(kdocitem)): "
              f"{m['grupos_duplicados']} (excedentes: "
              f"{m['filas_excedentes']})")
        print(f"notas con sum(totalrea) > val_rea: {m['notas_sobre_rea']} "
              f"(2026: {m['notas_sobre_rea_2026']})")
    return m


def _argumentos(argv):
    p = argparse.ArgumentParser(
        description="Diagnostico y limpieza historica D13/D14 (DBF -> Neon)")
    p.add_argument("--empresa", required=True, choices=sorted(EMPRESAS))
    p.add_argument("--tabla", required=True, choices=sorted(TABLAS))
    p.add_argument("--database-env", default="TEST_DATABASE_URL",
                   help="variable de entorno con la URL (default: "
                        "TEST_DATABASE_URL)")
    p.add_argument("--dbf", help="ruta DBF alternativa (copia sintetica)")
    p.add_argument("--apply", action="store_true",
                   help="habilita escritura; exige --max-delete-rows")
    p.add_argument("--max-delete-rows", type=int,
                   help="limite absoluto de borrados de esta corrida")
    return p.parse_args(argv)


def aplicar(conn, empresa, tabla, dbf_path, limite, leer, campos):
    pk = _pk_de(empresa, tabla)
    con_neon = [r[0] for r in _consultar(
        conn,
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = %s AND table_name = %s "
        "ORDER BY ordinal_position", (empresa, tabla))]
    try:
        cols = [c for c in campos(dbf_path) if c in con_neon]
    except (RuntimeError, OSError) as e:
        print(f"ABORTA: DBF ilegible: {e}")
        return 3
    if not cols:
        print(f"ABORTA: sin columnas reconocibles en el DBF {dbf_path}")
        return 3
    if not set(pk) <= set(cols):
        print(f"ABORTA: faltan columnas PK {pk} en el destino")
        return 3
    resultado = R.reconciliar_tabla(
        conn, empresa, tabla, cols, pk,
        lambda: leer(dbf_path), firma_fn=lambda: _firma(dbf_path),
        config=R.ConfigBorrado(True, limite))
    print(f"estado={resultado.estado} motivo={resultado.motivo!r} "
          f"upsert={resultado.upsert} candidatos={resultado.candidatos} "
          f"limite={resultado.limite} borrados={resultado.borrados}")
    return 1 if resultado.estado in (
        "ERROR", "LECTURA_INVALIDA", "SNAPSHOT_INVALIDO",
        "ARCHIVO_CAMBIO", "DESTINO_NO_PERMITIDO") else 0


def main(argv=None, env=None, conectar=None, leer=None, campos=None):
    args = _argumentos(argv)
    env = os.environ if env is None else env
    leer = leer or cargar_dbf
    campos = campos or campos_dbf
    if args.apply and args.max_delete_rows is None:
        print("ABORTA: --apply exige --max-delete-rows explicito")
        return 2
    if args.max_delete_rows is not None and args.max_delete_rows < 0:
        print("ABORTA: --max-delete-rows no puede ser negativo")
        return 2

    url = env.get(args.database_env)
    if not url:
        print(f"ABORTA: {args.database_env} no definida "
              f"(nunca se usa DATABASE_URL por defecto)")
        return 2
    if args.database_env == "DATABASE_URL":
        print("AVISO: destino de produccion pedido explicitamente "
              "(DATABASE_URL)")

    dbf_path = args.dbf or os.path.join(EMPRESAS[args.empresa],
                                        TABLAS[args.tabla])
    if conectar is None:
        import psycopg2
        conectar = psycopg2.connect
    try:
        conn = conectar(url)
    except Exception as e:
        print(f"ABORTA: no se pudo conectar: {e}")
        return 2

    try:
        if args.apply:
            return aplicar(conn, args.empresa, args.tabla, dbf_path,
                           args.max_delete_rows, leer, campos)
        conn.set_session(readonly=True)
        try:
            filas = leer(dbf_path)
            snap = R.validar_snapshot(filas, _pk_de(args.empresa, args.tabla))
        except (RuntimeError, OSError, R.SnapshotInvalido) as e:
            print(f"ABORTA: DBF invalido para reconciliar: {e}")
            return 3
        diagnosticar(conn, args.empresa, args.tabla, snap)
        print("dry-run: solo lectura; use --apply --max-delete-rows N para "
              "escribir")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
