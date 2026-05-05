import os
import sys
import time
import subprocess
import threading
import logging
from datetime import datetime
import psycopg2
from dotenv import load_dotenv

# Cargar .env
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
DATABASE_URL = os.getenv("DATABASE_URL")
SCRIPT_PATH = os.path.join(BASE_DIR, "sync_winfac_neon.py")
POLL_INTERVAL = 30  # segundos

log_path = os.path.join(BASE_DIR, "logs", "tray.log")
os.makedirs(os.path.dirname(log_path), exist_ok=True)
logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

def mark_completed(conn, request_id):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE public.sync_requests SET estado='completado', completed_at=NOW() WHERE id=%s",
            (request_id,)
        )
    conn.commit()

def run_sync(conn, request_id):
    log.info(f"Ejecutando sync para request_id={request_id}")
    try:
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            capture_output=True, text=True, timeout=300
        )
        log.info(f"Script terminó con código {result.returncode}")
        if result.stdout:
            log.info(result.stdout[-2000:])
        if result.stderr:
            log.warning(result.stderr[-1000:])
    except Exception as e:
        log.error(f"Error ejecutando script: {e}")
    finally:
        mark_completed(conn, request_id)
        log.info(f"Request {request_id} marcada como completada")

def poll_loop():
    log.info("Iniciando polling de sync_requests...")
    while True:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id FROM public.sync_requests
                    WHERE estado = 'pendiente'
                    ORDER BY created_at ASC
                    LIMIT 1
                """)
                row = cur.fetchone()

            if row:
                request_id = row[0]
                log.info(f"Request pendiente encontrada: id={request_id}")
                # Marcar como 'en_proceso' para evitar doble ejecución
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE public.sync_requests SET estado='en_proceso' WHERE id=%s AND estado='pendiente'",
                        (request_id,)
                    )
                conn.commit()
                run_sync(conn, request_id)

            conn.close()
        except Exception as e:
            log.error(f"Error en poll_loop: {e}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    log.info("sync_tray.pyw iniciado")
    t = threading.Thread(target=poll_loop, daemon=True)
    t.start()
    # Mantener proceso vivo
    while True:
        time.sleep(60)
