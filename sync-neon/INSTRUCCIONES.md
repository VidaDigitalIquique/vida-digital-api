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
