# Manual de Usuario Exhaustivo: VidaDigital Inventario v2

Este documento es una guía paso a paso detallada sobre cómo operar cada sección del sistema **VidaDigital**. 

---

## 1. Acceso y Configuración Inicial

### Cómo iniciar sesión
1. Diríjase a: [https://vidadigital-inventario-v2.vercel.app](https://vidadigital-inventario-v2.vercel.app)
2. En el campo **"RUT"**, escriba su número de identificación. *Nota: El sistema agregará automáticamente los puntos y el guion mientras escribe.*
3. En el campo **"Contraseña"**, ingrese su clave.
4. Haga clic en el botón azul **"Entrar"**.

### Cómo cambiar de Sucursal/Empresa
El sistema permite gestionar múltiples bodegas desde una sola cuenta.
1. Ubique el **menú desplegable** en la parte superior derecha de la pantalla (donde aparece el nombre de la empresa actual).
2. Haga clic en el nombre de la empresa.
3. Se desplegará una lista de las sucursales a las que tiene acceso.
4. Haga clic en la sucursal deseada. La página se actualizará automáticamente con los datos de esa sede.

---

## 2. Gestión de Inventario Masivo (Sincronización Excel)

Este módulo permite actualizar miles de productos a la vez.

### Paso 1: Acceder al importador
1. En la **barra superior**, ubique la sección **"Administración"**.
2. Haga clic sobre ella y seleccione la opción **"Importar Excel"**.

### Paso 2: Subir el archivo
1. Verá un recuadro grande con líneas punteadas y el ícono de una nube.
2. Haga clic en cualquier parte de ese recuadro (**"Haz clic para subir archivo Excel"**).
3. Se abrirá la ventana de su computadora. Busque y seleccione su archivo `.xlsx` o `.xls`.
4. El sistema analizará el archivo. Verá un mensaje: **"Análisis del documento..."**.

### Paso 3: Revisión de Pre-carga
Una vez analizado, el sistema no guarda los datos todavía. Le mostrará un resumen:
- **Total Detectados**: Cuántas filas leyó el Excel.
- **Listos para Subir**: Registros que cumplen con el formato correcto.
- **Con Errores**: Filas que el sistema ignorará (generalmente por falta de código SKU).
- Verá una tabla con una vista previa de los primeros 100 productos.

### Paso 4: Confirmación Final
1. Si los datos en la vista previa son correctos, haga clic en el botón verde **"Confirmar e Importar DB"** situado en la esquina superior derecha.
2. Espere a que la barra de carga termine. Aparecerá un mensaje de éxito: **"X productos sincronizados con éxito"**.

---

## 3. Toma de Inventario Físico (Auditoría)

Use esto para registrar lo que realmente hay en los estantes versus lo que dice el sistema.

### Cómo registrar el conteo
1. En la barra superior, haga clic en **"Inventario"**.
2. Verá una tabla con todos los productos de la sucursal.
3. Use la **Barra de Búsqueda** (ícono de lupa) para filtrar por código o nombre de producto.
4. Ubique la columna **"Físico"** (resaltada en azul claro).
5. Haga clic dentro del cuadro de texto de esa columna al lado del producto que está contando e ingrese el número.
    - El sistema calculará en tiempo real la **"Diferencia"**:
        - **Verde**: El conteo coincide con el sistema.
        - **Rojo**: Hay sobrantes o faltantes.
6. En la columna **"Obs"**, puede escribir notas (ej: "Caja dañada").
7. **IMPORTANTE**: Para guardar los cambios, debe subir al principio de la página y hacer clic en el botón naranja **"Guardar Cambios (X)"**. *Nota: Este botón parpadeará cuando tenga cambios pendientes.*

---

## 4. Gestión de Bodega (Ubicación Rápida)

Ideal para personal con tablets o celulares en pasillos.

### Cómo buscar y editar una ubicación
1. En la barra superior, haga clic en **"Bodega"**.
2. Haga clic en el cuadro **"Búsqueda Rápida"**. Escriba el código del estante o del producto.
3. Verá tarjetas con fotos de los productos.
4. Haga clic sobre la tarjeta del producto. Se abrirá una ventana lateral (Drawer).
5. En esta ventana puede:
    - Ver el **"Saldo Sistema"** actual.
    - Cambiar el **"Código de Ubicación"** (ej: cambiar del pasillo A1 al B3).
    - Escribir observaciones.
6. Haga clic en el botón azul de la parte inferior **"Guardar Cambios"**.

---

## 5. Procesamiento de Despachos (AI)

Automatice el registro de sus guías de despacho usando Inteligencia Artificial.

### Cómo procesar guías individualmente o en lote (ZIP)
1. En la barra superior, haga clic en **"Despachos"**.
2. Tiene dos opciones de subida:
    - **Botón "Subir Imagen"**: Para fotos individuales de guías.
    - **Botón "Subir (.zip)"**: Para procesar cientos de imágenes a la vez.
3. Al seleccionar las imágenes, el sistema las pondrá en una **"Cola de Procesamiento"**.
4. Verá el estado de cada imagen:
    - **"Extrayendo Folio..."**: La IA está leyendo la imagen.
    - **"Check Verde"**: El folio fue detectado y guardado.
    - **"Icono de Alerta"**: La IA no pudo leer el folio (se puede editar a mano).
5. El sistema guardará automáticamente la URL de la foto en la base de datos vinculada al folio.

---

## 6. Creación de Catálogos Públicos

Para enviar listas de precios a clientes externos sin que ellos tengan que entrar al sistema.

### Cómo crear un catálogo nuevo
1. En la barra superior, haga clic en el botón **"Catálogos"**.
2. Haga clic en el botón azul **"+ Nuevo Catálogo"** (esquina superior derecha).
3. Ingrese un **"Título Comercial"** (ej: "Saldos Invierno 2026").
4. Escriba una descripción breve opcional.
5. Haga clic en **"Crear"**.

### Cómo obtener el link para el cliente
1. En la lista de catálogos creados, verá una pequeña barra gris con el enlace.
2. Haga clic en el **ícono de la cadena** (Link) para copiar la URL.
3. Ya puede pegarla en WhatsApp o correo para sus clientes.
4. Para ver cómo lo verá el cliente, haga clic en el botón **"Ver"** (ícono de flecha externa).

---

## 7. Mantenimiento de Usuarios (Solo Admins)

### Cómo crear un nuevo acceso
1. En la barra superior, haga clic en **"Administración"**.
2. Seleccione la opción **"Usuarios"**.
2. Haga clic en **"+ Nuevo Usuario"**.
3. Complete el RUT, Nombre y defina el **Rol**:
    - **Vendedor**: Solo consulta precios y dashboard.
    - **Supervisor**: Logística total (Bodega, Inventario, Despachos).
    - **Admin**: Todo lo anterior más gestión de usuarios.
4. Asigne las **Empresas** a las que el usuario podrá entrar marcando los checks.
5. Ingrese una contraseña temporal.
6. Haga clic en **"Guardar Usuario"**.

---
*Manual actualizado el 16 de marzo de 2026.*
