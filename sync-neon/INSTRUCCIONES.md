# Sincronizador WinFac → Neon
# Instrucciones de instalación y configuración

## 1. Instalar Python
Si no tienes Python instalado, descárgalo de https://python.org
Versión recomendada: 3.11 o superior

## 2. Instalar dependencias
Abre PowerShell y ejecuta:
```
pip install dbfread psycopg2-binary python-dotenv
```

## 3. Crear archivo .env
En la misma carpeta donde guardaste sync_winfac_neon.py,
crea un archivo llamado ".env" con este contenido:
```
DATABASE_URL=postgresql://neondb_owner:TU_PASSWORD@TU_HOST.neon.tech/neondb?sslmode=require
```
Reemplaza con tu connection string real de Neon.

## 4. Probar manualmente
```
python sync_winfac_neon.py
```

## 5. Programar en Task Scheduler (Windows)
- Abre "Programador de tareas" (Task Scheduler)
- Crear tarea básica
- Nombre: "Sync WinFac Neon"
- Desencadenador: Diariamente a las 23:00
- Acción: Iniciar programa
  - Programa: python
  - Argumentos: C:\ruta\donde\guardaste\sync_winfac_neon.py
  - Iniciar en: C:\ruta\donde\guardaste\

## 6. Verificar logs
Los logs se guardan en la carpeta "logs/" junto al script.
Cada ejecución crea un archivo con fecha/hora.

## 7. Sincronización de imágenes con Cloudinary

### Instalar dependencia adicional
pip install cloudinary

### Agregar variables al archivo .env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key  
CLOUDINARY_API_SECRET=tu_api_secret
IMAGENES_PATH=Z:\Imagenes

### ¿Cómo funciona?
- Al ejecutar el script, después de sincronizar los datos de WinFac,
  se sincroniza automáticamente la carpeta Z:\Imagenes con Cloudinary.
- Las imágenes nuevas se suben automáticamente.
- Las imágenes modificadas (fecha de modificación más reciente que
  la fecha de subida en Cloudinary) se re-suben automáticamente.
- Las imágenes sin cambios se saltan para no desperdiciar ancho de banda.
- El nombre del archivo (sin extensión) se usa como código del producto.
  Ejemplo: AB-123.jpg → public_id: productos/AB-123
- Después de subir cada imagen, se actualiza imagen_url en la base
  de datos Neon automáticamente.

### Verificar en los logs
Busca en logs/latest.log líneas con:
  [NEW]    → imagen subida por primera vez
  [UPDATE] → imagen re-subida porque fue modificada
  [SKIP]   → imagen sin cambios, no se re-sube
  [ERROR]  → error al subir (revisar el mensaje)

## 8. Borrado de filas obsoletas (itemdcto y movidcto)

### Instalación en el PC de Pravin
1. Copia a la carpeta del sincronizador, junto a `sync_winfac_neon.py`:
   `sync_winfac_neon.py`, `reconciliacion.py` y `env.example`.
   Sin `reconciliacion.py` el script falla al iniciar.
2. Dependencias: las mismas de las secciones 2 y 7
   (`dbfread`, `psycopg2-binary`, `python-dotenv`, `cloudinary`).
3. En el `.env` existente agrega (no reemplaces `DATABASE_URL`):
```
SYNC_DELETE_ENABLED=false
SYNC_DELETE_MAX_ROWS=100
```
4. No cambies el lanzador ni la tarea programada: la interfaz de
   `sync_winfac_neon.py` es la misma.

### Guardas
- Solo `itemdcto` y `movidcto`, en los esquemas `vida` y `sanjh`.
  `inb`, `inventar`, `clientes` e imágenes conservan su flujo (sin borrado).
- `SYNC_DELETE_ENABLED=false` (por defecto): nunca borra; el UPSERT sí se aplica.
- `SYNC_DELETE_MAX_ROWS=100`: máximo absoluto por tabla y esquema, por ejecución.
  `0` solo permite ejecuciones sin candidatos; un valor inválido bloquea el borrado.
- Un snapshot vacío, una lectura fallida, una PK inválida o un DBF que cambia
  durante la lectura **no producen ninguna escritura** (ni UPSERT ni DELETE).
- El UPSERT y el DELETE del destino se confirman juntos; si algo falla, se revierte todo.
- Para comparar PK se usan los valores tal como están en Neon (sin recortar):
  una fila antigua `"  1"` no coincide con la PK canónica `"1"` y puede borrarse.

### Estados en el log
- `upsert=N, borrados=M, candidatos=K` → reconciliación completada.
- `BORRADO_OMITIDO <esquema>.<tabla>: flag_apagado; candidatos=K, limite=L` →
  UPSERT aplicado, nada borrado porque el flag está apagado.
- `BORRADO_OMITIDO ...: limite_excedido (K > L)` → UPSERT aplicado, nada borrado
  porque se superó el límite. Revisar antes de subir `SYNC_DELETE_MAX_ROWS`.
- `snapshot invalido` / `lectura invalida` / `archivo cambio durante la lectura` →
  sin escrituras en ese destino.
- `ERROR <esquema>.<tabla>` → se revirtió la transacción de ese destino.

### Operación manual recomendada
1. Pausa la tarea programada y el polling (`sync_tray.pyw`) antes de activar el borrado.
2. Acuerda con WinFac una **ventana sin escrituras** en los DBF mientras corre el sync.
3. Primera corrida con `SYNC_DELETE_ENABLED=false`: revisa en el log
   `BORRADO_OMITIDO` y cuántos candidatos hay por tabla/esquema.
4. Si los candidatos son razonables (≤ límite), activa `SYNC_DELETE_ENABLED=true`
   y ejecuta otra vez con WinFac detenido. Revisa `borrados=` en el log.
5. Ejecuta una segunda corrida: debe dar `candidatos=0` (idempotente).
6. Reanuda la tarea y el polling; conserva los logs fechados como evidencia.

`sync_tray.pyw` marca la solicitud como completada aunque el sync falle:
no uses ese estado como prueba; revisa siempre el log fechado del sincronizador.
