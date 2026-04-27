"""
sync_winfac_neon.py
====================
Sincroniza las tablas DBF de WinFac con Neon PostgreSQL.
Empresas: SANJH (schema: sanjh) y VIDA DIGITAL (schema: vida)

Requisitos:
    pip install dbfread psycopg2-binary python-dotenv

Configuracion:
    Crea un archivo .env en la misma carpeta con:
    DATABASE_URL=postgresql://...tu_connection_string_de_neon...

Programar en Task Scheduler:
    - Programa: python
    - Argumentos: C:\\sync_neon\\sync_winfac_neon.py
    - Frecuencia: Diario, 09:00
"""

import os
import sys
import logging
from datetime import datetime
import base64
from dbfread import DBF
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
import cloudinary.api

# ============================================================
# CONFIGURACION
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
IMAGENES_PATH         = os.getenv("IMAGENES_PATH", r"Z:\Imagenes")
EXTENSIONES_VALIDAS   = {".jpg", ".jpeg", ".png", ".webp"}

# Rutas a las carpetas DBF
# base_path    -> modulo permanente (itemdcto, movidcto, inventar, etc.)
# winfac_path  -> carpeta de trabajo activo de WinFac (inb.dbf)
EMPRESAS = {
    "sanjh": {
        "schema": "sanjh",
        "base_path": r"C:\red\newdesar\winfac_nna\Base",
        "winfac_path": r"C:\sisvfp\WinFac_nna",
    },
    "vida": {
        "schema": "vida",
        "base_path": r"C:\red\newdesar\winfac_nna\VIDAD",
        "winfac_path": r"C:\sisvfp\WinFac_nna",
    },
}

# Tablas a sincronizar
# use_winfac_path: True -> lee desde winfac_path en lugar de base_path
TABLAS = {
    "itemdcto": {
        "dbf_file": "itemdcto.dbf",
        "use_winfac_path": False,
        "pk_columns": ["knumfoli", "kdocitem"],
        "columnas": [
            "empresaa", "knumfoli", "id_tdocu", "docuzofr", "knumdocu",
            "codunico", "cantentr", "cantsali", "precdocd", "precread",
            "codclasi", "knumorde", "kdocitem", "knumezet", "totaldoc",
            "totalrea", "imptoiva", "porceiad", "codigiad", "imptoiad",
            "codiveri", "codbarra", "cod_modul", "coleccion", "norcont",
            "itmx", "cantxcaja", "peso", "pestadot", "fechaite",
            "usuarios", "infventa", "num", "cifunita", "viuprodt",
            "cosunita", "rec_inv", "cantidad", "tcancaja", "tpescaja",
            "tcubcaja", "desunida", "totcif", "descrip", "descrip2",
            "codunico2", "codigo", "cargasrf", "adulegal", "totaladi",
            "fob", "flete", "seguro", "cif", "unidaddd"
        ]
    },
    "movidcto": {
        "dbf_file": "movidcto.dbf",
        "use_winfac_path": False,
        "pk_columns": ["knumfoli"],
        "columnas": [
            "tipomovi", "id_tdocu", "docuzofr", "monedaaa", "fechanvt",
            "knumfoli", "fechadoc", "knumdocu", "subfactu", "subfacfe",
            "ub_merca", "usuarioo", "ocupado", "codclasi", "foliouni",
            "caduana", "visaadua", "visacpdd", "fechconf", "horaconf",
            "usuaconf", "codiveri", "corredir", "pcodarea", "pestadot",
            "pformpag", "knumerut", "vendedor", "kcodclie", "kcodcli2",
            "numfoli2", "pcodimpt", "tcodavan", "pcodivia", "tcodplaz",
            "pcodsegu", "pcodpais", "moduloss", "pcoddest", "resolimp",
            "fechares", "codanexo", "desanexo", "cananexo", "maranexo",
            "pesanexo", "codanexo1", "desanexo1", "cananexo1", "maranexo1",
            "pesanexo1", "continuo", "hojassss", "descrip", "kincliva",
            "rutcompr", "nomcompr", "infventa", "vl_tiptot", "monecmp",
            "vl_factur", "vl_gastos", "vl_fob", "vl_flete", "vl_seguro",
            "vl_cif", "vl_viu", "codproce", "coddesti", "tipo",
            "zncoddes", "zncodext", "region", "medtrans", "tipocamb",
            "resnum", "resfec", "resemi", "ubcoddes", "segpaga",
            "monedcmp", "consumo", "observa", "observa2", "codbulto",
            "canbulto", "pesbulto", "impzof", "val_doc", "val_izf",
            "val_iva", "val_iad", "val_rea", "cliente", "topeuaf",
            "credito", "estanota", "factura", "cubbulto", "pilotero",
            "impadic1", "cargasrf", "ntestado", "legaliza"
        ]
    },
    "inb": {
        "dbf_file": "inb.dbf",
        "use_winfac_path": True,
        "pk_columns": ["knumezet"],
        "columnas": [
            "codunico", "codclasi", "ubizofri", "knumezet", "procede",
            "entradas", "salidass", "stocdisp", "stocfisi", "stdentra",
            "stdsalid", "stddispo", "stdcfisi", "factorrr", "cifunita",
            "ciftotal", "cosunit1", "cosunita", "viuprodt", "partaran",
            "descript", "codiveri", "unidaddd", "desunida", "codigiad",
            "monedaaa", "kcodunid", "proceden", "origemer", "ptoemba",
            "ptipomer", "pcomprad", "contador", "codbarra", "codadic",
            "adic", "cantcaja", "pesocaja", "cubicaja", "unidxset",
            "orgext1", "cobueno1", "nvbueno1", "fvbueno1", "ovbueno1",
            "orgext2", "cobueno2", "nvbueno2", "fvbueno2", "ovbueno2",
            "p_rojo", "p_verde", "p_modul", "cosunic", "codmarca",
            "codfami", "cantentr", "cantsali", "sdo_ent", "sdo_sad",
            "sdo_saf", "sdo_en", "sdo_sa", "sdo_st", "stw", "knumdocu",
            "monedcmp", "tipoarti", "descrip2", "cifunit2", "viuprod2",
            "cosunit2", "fobrmb", "fechaing", "fechaite", "monrmb",
            "cancaja", "pescaja", "notainsu", "visaadua", "adulegal",
            "invoice", "infprodu", "visprod", "fecprod", "horprod",
            "legprod", "legaliza"
        ]
    },
    "inventar": {
        "dbf_file": "inventar.dbf",
        "use_winfac_path": False,
        "pk_columns": ["knumezet"],
        "columnas": [
            "codunico", "codclasi", "ubizofri", "knumezet", "procede",
            "entradas", "salidass", "stocdisp", "stocfisi", "stdentra",
            "stdsalid", "stddispo", "stdcfisi", "factorrr", "cifunita",
            "ciftotal", "cosunit1", "cosunita", "viuprodt", "partaran",
            "descript", "codiveri", "unidaddd", "desunida", "codigiad",
            "monedaaa", "kcodunid", "proceden", "origemer", "ptoemba",
            "ptipomer", "pcomprad", "contador", "codbarra", "codadic",
            "adic", "cantcaja", "pesocaja", "cubicaja", "unidxset",
            "orgext1", "cobueno1", "nvbueno1", "fvbueno1", "ovbueno1",
            "orgext2", "cobueno2", "nvbueno2", "fvbueno2", "ovbueno2",
            "p_rojo", "p_verde", "p_modul", "cosunic", "codmarca",
            "codfami", "cantentr", "cantsali", "sdo_ent", "sdo_sad",
            "sdo_saf", "sdo_en", "sdo_sa", "sdo_st", "stw", "knumdocu",
            "monedcmp", "tipoarti", "descrip2", "cifunit2", "viuprod2",
            "cosunit2", "fobrmb", "fechaing", "fechaite", "monrmb",
            "cancaja", "pescaja", "notainsu", "visaadua", "adulegal",
            "invoice", "infprodu", "visprod", "fecprod", "horprod",
            "legprod", "legaliza", "tpbueno1", "tpbueno2", "crbueno1",
            "crbueno2", "nrocont", "sqlunico"
        ]
    },
    "clientes": {
        "dbf_file": "clientes.dbf",
        "use_winfac_path": False,
        "pk_columns": ["kcodclie"],
        "columnas": [
            "kcodclie", "nombress", "pasaporte", "rutclien", "numecont",
            "digiveri", "fechcont", "bloqueoo", "pcodclas", "pcodcost",
            "pcodcobr", "pcodrepa", "pcodpais", "pdespais", "pcodzona",
            "pdiascre", "usutipo", "telefono", "fax", "telecasa",
            "celular", "producto", "fechin", "pais", "ciudad",
            "email01", "email02", "pagweb", "nomusua", "zofri",
            "kcodclie1", "bloqueo", "lineacre", "observa", "moneda",
            "fechaing", "comprador", "kcodcli2", "codava", "codreg"
        ]
    },
}

# ============================================================
# LOGGING
# ============================================================
log_dir = os.path.join(BASE_DIR, "logs")
os.makedirs(log_dir, exist_ok=True)

log_file = os.path.join(log_dir, f"sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
latest_log = os.path.join(log_dir, "latest.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)

try:
    if os.path.exists(latest_log):
        os.remove(latest_log)
    import shutil
    shutil.copy(log_file, latest_log)
except Exception:
    pass

# ============================================================
# HELPERS
# ============================================================
def safe_value(val):
    """Convierte valores DBF a tipos compatibles con PostgreSQL."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, datetime):
        return val
    if isinstance(val, bool):
        return val
    return str(val).strip() if str(val).strip() != "" else None


def read_dbf(path: str, columnas: list) -> list[dict]:
    """Lee un archivo DBF y retorna lista de dicts con las columnas solicitadas."""
    try:
        table = DBF(path, encoding="latin-1", ignore_missing_memofile=True)
        rows = []
        for record in table:
            row = {}
            for col in columnas:
                val = record.get(col.upper())
                if val is None:
                    val = record.get(col.lower())
                row[col.lower()] = safe_value(val)
            rows.append(row)
        log.info(f"  Leidas {len(rows)} filas de {os.path.basename(path)}")
        return rows
    except Exception as e:
        log.error(f"  Error leyendo {path}: {e}")
        return []


def sync_tabla(conn, schema: str, tabla: str, config: dict, dbf_path: str):
    """Sincroniza una tabla DBF con Neon usando UPSERT."""
    log.info(f"Sincronizando {schema}.{tabla}...")

    rows = read_dbf(dbf_path, config["columnas"])
    if not rows:
        log.warning(f"  Sin datos para {schema}.{tabla}")
        return 0

    columnas = config["columnas"]
    pk = config["pk_columns"]

    before = len(rows)
    rows = [r for r in rows if all(r.get(k) not in (None, '', ' ') for k in pk)]
    skipped = before - len(rows)
    if skipped > 0:
        log.info(f"  Omitidas {skipped} filas con PK nula/vacia")

    seen = {}
    for row in rows:
        key = tuple(row[k] for k in pk)
        seen[key] = row
    rows = list(seen.values())
    deduped = before - skipped - len(rows)
    if deduped > 0:
        log.info(f"  Deduplicadas {deduped} filas en memoria")

    if not rows:
        log.warning(f"  Sin filas validas para {schema}.{tabla}")
        return 0

    update_cols = [c for c in columnas if c not in pk]
    update_set = ", ".join([f"{c} = EXCLUDED.{c}" for c in update_cols])

    insert_sql = f"""
        INSERT INTO {schema}.{tabla} ({', '.join(columnas)})
        VALUES %s
        ON CONFLICT ({', '.join(pk)}) DO UPDATE SET
        {update_set}
    """

    values = [tuple(row[c] for c in columnas) for row in rows]

    try:
        with conn.cursor() as cur:
            execute_values(cur, insert_sql, values, page_size=500)
        conn.commit()
        log.info(f"  {len(rows)} registros sincronizados en {schema}.{tabla}")
        return len(rows)
    except Exception as e:
        conn.rollback()
        log.error(f"  Error en {schema}.{tabla}: {e}")
        return 0


# ============================================================
# MAIN
# ============================================================
def sync_imagenes():
    """
    Sincroniza imágenes desde IMAGENES_PATH hacia Cloudinary (folder: productos/).
    - Sube imágenes nuevas (no existen en Cloudinary)
    - Re-sube imágenes modificadas (mtime local > created_at en Cloudinary)
    - Salta imágenes sin cambios
    - Actualiza imagen_url en public.productos en Neon
    """
    log.info("\n" + "=" * 60)
    log.info("INICIO SINCRONIZACION DE IMAGENES")
    log.info(f"Carpeta: {IMAGENES_PATH}")

    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        log.error("Faltan variables de Cloudinary en .env. Saltando sync de imágenes.")
        return

    if not os.path.exists(IMAGENES_PATH):
        log.error(f"Carpeta de imágenes no encontrada: {IMAGENES_PATH}")
        return

    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )

    # Conectar a Neon para actualizar imagen_url
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as e:
        log.error(f"No se pudo conectar a Neon para sync de imágenes: {e}")
        return

    archivos = [
        f for f in os.listdir(IMAGENES_PATH)
        if os.path.splitext(f)[1].lower() in EXTENSIONES_VALIDAS
    ]

    log.info(f"Archivos encontrados: {len(archivos)}")

    nuevas = 0
    actualizadas = 0
    saltadas = 0
    errores = 0

    for archivo in archivos:
        nombre_sin_ext = os.path.splitext(archivo)[0]
        public_id = f"productos/{nombre_sin_ext}"
        ruta_local = os.path.join(IMAGENES_PATH, archivo)
        mtime_local = os.path.getmtime(ruta_local)

        try:
            # Verificar si existe en Cloudinary
            info = cloudinary.api.resource(public_id)
            created_at_str = info.get("created_at", "")
            # Parsear fecha de Cloudinary
            from datetime import timezone
            created_at = datetime.strptime(
                created_at_str, "%Y-%m-%dT%H:%M:%SZ"
            ).replace(tzinfo=timezone.utc).timestamp()

            if mtime_local <= created_at:
                log.info(f"  [SKIP] {archivo} — sin cambios")
                saltadas += 1
                continue

            # Modificada — re-subir
            with open(ruta_local, "rb") as f:
                b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
            result = cloudinary.uploader.upload(
                b64,
                folder="productos",
                public_id=nombre_sin_ext,
                overwrite=True,
            )
            log.info(f"  [UPDATE] {archivo} → {result['secure_url']}")
            actualizadas += 1
            _actualizar_neon(conn, nombre_sin_ext, result["secure_url"], result["public_id"])

        except cloudinary.exceptions.NotFound:
            # No existe — subir nueva
            try:
                with open(ruta_local, "rb") as f:
                    b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
                result = cloudinary.uploader.upload(
                    b64,
                    folder="productos",
                    public_id=nombre_sin_ext,
                    overwrite=False,
                )
                log.info(f"  [NEW] {archivo} → {result['secure_url']}")
                nuevas += 1
                _actualizar_neon(conn, nombre_sin_ext, result["secure_url"], result["public_id"])
            except Exception as e:
                log.error(f"  [ERROR] {archivo}: {e}")
                errores += 1

        except Exception as e:
            log.error(f"  [ERROR] {archivo}: {e}")
            errores += 1

    conn.close()

    log.info(f"\nIMAGENES: {nuevas} nuevas, {actualizadas} actualizadas, "
             f"{saltadas} sin cambios, {errores} errores")
    log.info("=" * 60)


def _actualizar_neon(conn, codigo: str, imagen_url: str, public_id: str):
    """Actualiza imagen_url y public_id en public.productos para el código dado."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.productos
                SET imagen_url = %s, public_id = %s, updated_at = NOW()
                WHERE codigo = %s
                """,
                (imagen_url, public_id, codigo)
            )
        conn.commit()
        log.info(f"    Neon actualizado: {codigo}")
    except Exception as e:
        conn.rollback()
        log.error(f"    Error actualizando Neon para {codigo}: {e}")


def main():
    log.info("=" * 60)
    log.info("INICIO SINCRONIZACION WinFac - Neon")
    log.info(f"Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info(f"BASE_DIR: {BASE_DIR}")
    log.info(f".env path: {dotenv_path}")
    log.info("=" * 60)

    if not DATABASE_URL:
        log.error("DATABASE_URL no configurada. Revisa archivo .env")
        sys.exit(1)

    try:
        conn = psycopg2.connect(DATABASE_URL)
        log.info("Conectado a Neon PostgreSQL")
    except Exception as e:
        log.error(f"No se pudo conectar a Neon: {e}")
        sys.exit(1)

    total_sync = 0

    for empresa_key, empresa_cfg in EMPRESAS.items():
        schema = empresa_cfg["schema"]
        base_path = empresa_cfg["base_path"]
        winfac_path = empresa_cfg["winfac_path"]

        log.info(f"\n{'-' * 40}")
        log.info(f"Empresa: {empresa_key.upper()} - schema: {schema}")
        log.info(f"base_path: {base_path}")
        log.info(f"winfac_path: {winfac_path}")

        for tabla, config in TABLAS.items():
            use_winfac = config.get("use_winfac_path", False)
            folder = winfac_path if use_winfac else base_path

            if not os.path.exists(folder):
                log.warning(f"  Carpeta no encontrada: {folder}")
                continue

            dbf_path = os.path.join(folder, config["dbf_file"])
            if not os.path.exists(dbf_path):
                log.warning(f"  Archivo no encontrado: {dbf_path}")
                continue

            total_sync += sync_tabla(conn, schema, tabla, config, dbf_path)

    # Sincronizar imágenes
    sync_imagenes()

    conn.close()

    log.info(f"\n{'=' * 60}")
    log.info(f"SINCRONIZACION COMPLETADA - {total_sync} registros procesados")
    log.info(f"Log guardado en: {log_file}")
    log.info("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.exception(f"ERROR CRITICO NO CONTROLADO: {e}")
        sys.exit(1)
