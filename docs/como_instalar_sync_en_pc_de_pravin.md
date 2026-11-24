# D13/D14 — Limpieza histórica WinFac → Neon (s10f-3)

Contrato operativo de `scripts/limpiar_winfac_historico.py`. El script es una CLI
separada del sincronizador: diagnostica o aplica la reconciliación de
`itemdcto`/`movidcto` (esquemas `vida` y `sanjh`) reutilizando
`sync-neon/reconciliacion.py`. No toca la UI ni el motor de sincronización.

## Modelo de seguridad

- **Destino por defecto `TEST_DATABASE_URL`.** Si la variable no existe, el
  script aborta con código 2 **antes de leer el DBF o conectar**. Nunca cae a
  `DATABASE_URL`: usar producción exige pedirlo con
  `--database-env DATABASE_URL` y queda registrado en la salida.
- **Sin `--apply` es diagnóstico de solo lectura:** abre la conexión con
  `set_session(readonly=True)`, hace únicamente `SELECT` y no crea tablas
  temporales. Cualquier escritura en ese modo es un fallo.
- **`--apply` exige `--max-delete-rows N`** (entero ≥ 0). Sin límite aborta.
  El borrado real lo decide el motor: snapshot válido, flag de borrado,
  candidatos ≤ límite, una transacción, rollback ante cualquier error.
- **El DBF manda.** Se borra lo que ya no existe en el DBF. Las métricas de
  `val_rea`, código de producto o número de nota son **solo diagnóstico**:
  nunca seleccionan filas para borrar.
- **Lista cerrada:** `--empresa` acepta `vida|sanjh`; `--tabla` acepta
  `itemdcto|movidcto`.

## Uso

```powershell
# Diagnóstico (solo lectura) contra la base de pruebas
python scripts/limpiar_winfac_historico.py --empresa vida --tabla itemdcto `
  --database-env TEST_DATABASE_URL

# Aplicación explícita con límite revisado
python scripts/limpiar_winfac_historico.py --empresa sanjh --tabla itemdcto `
  --database-env TEST_DATABASE_URL --apply --max-delete-rows 20000
```

Opciones: `--dbf RUTA` (copia sintética en vez del DBF instalado),
`--database-env NOMBRE` (default `TEST_DATABASE_URL`).

Códigos de salida: `0` OK/borrado omitido, `1` error del motor
(LECTURA_INVALIDA, SNAPSHOT_INVALIDO, ARCHIVO_CAMBIO, ERROR…), `2` uso/entorno/
conexión, `3` DBF ilegible o fuera de contrato.

### Qué muestra el dry-run

- Filas y PKs del DBF, PKs en Neon y PKs de Neon **ausentes del DBF**: ese es
  el máximo de candidatos a borrado.
- Filas de `itemdcto` con `kdocitem <> trim(kdocitem)` y grupos duplicados por
  `(knumfoli, trim(kdocitem))` con sus filas excedentes.
- Notas con `sum(itemdcto.totalrea) > movidcto.val_rea` (agregando primero las
  líneas por folio) y cuántas son de 2026.

## Evidencia requerida antes de un `--apply`

1. Salida completa del dry-run de la misma empresa/tabla, misma copia de DBF y
   misma base destino.
2. Conteo de PKs ausentes y su comparación con el límite que se usará.
3. Hash o sello de la copia del DBF (tamaño + fecha) y respaldo de las filas
   que se van a borrar (`SELECT` de esas PKs guardado aparte).
4. Ventana sin escrituras de WinFac y polling/tarea programada pausados.
5. Después del `--apply`: estado/motivo/candidatos/borrados de la salida y una
   **segunda corrida idempotente** que debe reportar `candidatos=0, borrados=0`.

## Casos QA

- **Dado** Vida 002499 reconciliada, **cuando** el admin abre su modal,
  **entonces** ve únicamente HS-30 y HS-30C y total 2.550.
- **Dado** SANJH 000812 reconciliada, **cuando** abre el modal y las ventas de
  1030A, **entonces** aparece una sola línea/venta correspondiente a esa nota y
  el conteo coincide con el detalle.
- **Dada** una cabecera eliminada del DBF sintético, **cuando** recarga el
  listado, **entonces** desaparece solo de su empresa y las comisiones
  coinciden con las cabeceras restantes.
- **Dado** el flag de borrado apagado, **cuando** sincroniza y recarga,
  **entonces** las filas obsoletas permanecen y el log explica la omisión.
- **Dada** una nota ajena a las anomalías, **cuando** consulta detalle y
  ganancia, **entonces** conserva sus valores.

## Pasos manuales en el PC de Pravin

1. Identificar la carpeta realmente instalada y los lanzadores activos; no
   asumir que es `C:\sync_neon`.
2. Pausar el polling y la tarea programada; acordar una ventana sin escrituras
   de WinFac.
3. Respaldar scripts/configuración existentes y preparar la recuperación de los
   datos que se borrarán.
4. Copiar los archivos aprobados conservando la estructura necesaria para los
   imports. Mantener el `.env` local (no se lee ni se imprime).
5. Verificar dependencias documentadas: `dbfread`, `psycopg2-binary`,
   `python-dotenv`, `cloudinary`.
6. Ejecutar tests y smoke en pruebas; luego dry-run de cada empresa/tabla y
   revisar los conteos de arriba.
7. Solo con la autorización de Pablo para tocar datos reales, ejecutar
   `--apply` con límites explícitos revisados; comparar métricas antes/después
   y verificar las dos notas del backlog.
8. Activar el borrado periódico, reanudar los lanzadores y comprobar en el log
   fechado una segunda corrida idempotente.

## Corrida contra producción (solo con autorización de Pablo)

```powershell
# 1) diagnóstico primero, producción explícita
python scripts/limpiar_winfac_historico.py --empresa vida --tabla itemdcto `
  --database-env DATABASE_URL

# 2) con los conteos revisados por el Director y el respaldo hecho
python scripts/limpiar_winfac_historico.py --empresa vida --tabla itemdcto `
  --database-env DATABASE_URL --apply --max-delete-rows <revisado>
```

Reglas para producción: el límite nunca se copia del default; se fija por
debajo de los candidatos observados, se corre una empresa/tabla por vez y se
espera la segunda corrida idempotente antes de la siguiente. Si la salida es
`BORRADO_OMITIDO`, no se reintenta con más límite sin nueva revisión: el motivo
(`limite_excedido` o `flag_apagado`) debe quedar explicado.

## Verificación automática

```powershell
python -m unittest sync-neon/test_limpieza_historica.py -v
python -m unittest discover -s sync-neon -p "test_*.py"
python -m ruff check scripts/limpiar_winfac_historico.py sync-neon/test_limpieza_historica.py
```

Los tests inyectan lector/campos/conexión falsos: no requieren DBF reales ni
base de datos y nunca leen `DATABASE_URL`.
