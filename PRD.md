# PRD — Actualización "Detalle de ventas registradas" + Módulo VENDEDORES

Versión 1 · 2026-11-11 · Product Owner: Pablo · Director Técnico: Claude
Base: repo `vida-digital-api` en commit `88e8d83` (release D1-D5 desplegado en `2ac571c`).
Todas las definiciones de datos de este documento están **verificadas** contra la base de pruebas (copia de producción del
2026-11-11) y respondidas por Pablo. Lo que no está aquí no se asume: es gate humano.

---

## 1. Qué es

1. **Actualización (drawer de /precios):** en el drawer de un producto, el texto "N ventas registradas" pasa a ser clickeable y
   muestra el detalle de cada una de esas ventas: cliente de la nota de venta y precio al que compró (más fecha, nota, empresa,
   vendedor y cantidad si caben).
2. **Módulo VENDEDORES (nuevo, solo administradores):** tabla de todas las notas de venta (pendientes de facturar y facturadas)
   de Vida Digital y SANJH, con filtros persistentes por usuario; modal con el detalle de cada venta (imagen, código, costo,
   % sobre costo, cajas, precio, ganancia USD); e informe mensual de comisiones por vendedor, exportable a .xlsx.

## 2. Usuarios

| Rol | Actualización drawer | Módulo VENDEDORES |
|-----|----------------------|-------------------|
| admin | Sí (ya ve /precios) | Sí: único rol que lo ve (menú, página y APIs) |
| vendedor | Sí (ya ve /precios) | No: no ve el menú; la ruta y las APIs le niegan acceso |
| bodeguero | No (no ve /precios) | No |

## 3. Definiciones de datos (verificadas)

Fuente: réplica de WinFac en Neon, esquemas `vida` (Vida Digital, empresa_id 2) y `sanjh` (SANJH, empresa_id 1). Solo lectura
(CLAUDE.md: no modificar su estructura).

| Concepto | Definición | Evidencia |
|----------|-----------|-----------|
| Nota de venta | `movidcto` con `tipomovi='V'` y `id_tdocu IN ('203','551','554')` | Mismo criterio que `app/api/seguimientos/route.ts` |
| Fecha de la venta | `movidcto.fechanvt` | Sin nulos en notas |
| Fecha de facturación | `movidcto.fechadoc` | 0 facturadas sin fechadoc (vida 2378, sanjh 3232) |
| Facturada (traspaso hecho) | `pestadot='3'` y `visaadua` no vacío | visaadua/visacpdd siempre juntos: llenos con pestadot 3, vacíos con pestadot 1 |
| Pendiente de facturar | `pestadot='1'` y `visaadua` vacío | Ídem |
| Número de visación (el que se muestra) | `movidcto.visaadua` (ej. 431033) | Pablo, pregunta 2 |
| Cliente de la nota de venta | `movidcto.cliente` (texto) | Pablo: en la nota SANJH 003816 es "DILIP MAYANI" = `movidcto.cliente` (no `factura` ni `clientes(kcodclie)`) |
| Vendedor | `movidcto.vendedor` (texto WinFac) | Valores 2026: PRAVIN, JOSEPH LEVANO, ANGELA, ANIL CHANDNANI, PABLO BRAVO; histórico además EMPRESA y vacío |
| Vendedores excluidos del módulo | `PABLO BRAVO`, `EMPRESA` y vacío/NULL: no aparecen en ninguna parte del módulo | Pablo |
| Total de la nota (base de comisión) | `movidcto.val_rea` (valor real WinFac) | Pablo: "usar el total de la nota de WinFac". `val_doc` es el valor documento (≈ la mitad en 35% de las notas; ej. vida 002514 val_rea 825 / val_doc 412,50) |
| Líneas de la nota | `itemdcto` por `knumfoli` (mismo esquema) | Todas las facturadas tienen líneas; 33 pendientes no |
| Precio de venta unitario | `itemdcto.precread` (real) | Igual que el drawer actual. `precdocd` (documento) puede quedar bajo el costo: no se usa |
| Costo unitario | `itemdcto.cosunita` (costo al momento de la venta) | Sin ceros en 2026; coincide con `productos.costo` en las muestras |
| Cajas | `itemdcto.tcancaja` (cajas) · `cantxcaja` (unid/caja) · `cantsali` (unidades) | Igual que Seguimientos |
| Ganancia de la línea (USD) | `(precread - cosunita) * cantsali` | — |
| % sobre el costo | `(precread - cosunita) / cosunita * 100` | — |
| Imagen | `public.productos.imagen_url` por `codigo = itemdcto.codunico` y `empresa_id` | `productos` tiene **una fila por ingreso**: unir por código multiplica filas (ver Riesgos) |
| Moneda | Notas facturadas 2026: todas `monedaaa='13'` (USD) | 6 notas históricas de SANJH con `monedaaa='200'` (ver Preguntas abiertas) |
| Fechas futuras | Notas con `fechanvt` posterior a hoy (hora de Chile) **no existen** para el módulo: son errores de digitación que WinFac no deja borrar | Pablo, pregunta 3. Hoy: 18 pendientes con fechas 2027-2125 |
| Pendientes sin líneas | No se muestran | Pablo, pregunta 4 |

## 4. MVP

### A. Actualización del drawer de /precios
A1. "N ventas registradas" es un botón/enlace; al hacer clic se despliega (en el mismo drawer o en un panel/modal propio) la lista
    de esas N ventas.
A2. Cada fila: **cliente de la nota** y **precio de venta** (destacados), más fecha de la venta, número de nota, vendedor, cantidad
    (cajas y unidades). Orden: fecha descendente.
A3. La lista contiene exactamente las mismas ventas que cuenta "N ventas registradas" hoy (`/api/kardex`: todas las salidas
    `tipomovi='V'` con `precread>0` y `cantsali>0`, **incluidos** cambios de ubicación y tipo 552, sin los clientes excluidos del
    kardex). Pablo, pregunta 8: "todo, incluidos los cambios de ubicación".
A4. Empresa: la del drawer (el `empresaSlug` que ya usa `/api/kardex`).

### B. Módulo VENDEDORES
B1. Menú: opción **VENDEDORES** a la derecha del desplegable **ADMINISTRACIÓN** en `components/TopNav.tsx` (y en el menú móvil
    si existe), solo para admin. Ruta `/vendedores`.
B2. Tabla de notas de venta de **ambas empresas** con columna **Empresa** (Vida Digital / SANJH). Columnas mínimas: Empresa,
    Fecha de venta, N° nota (`knumfoli`), Cliente, Vendedor, Total (USD, `val_rea`), Estado (Pendiente / Facturada), N° de
    visación (si tiene), Fecha de facturación (si tiene).
B3. Filtros:
    - Vendedor (lista de vendedores válidos de las notas, sin los excluidos; incluye a los que también son admin).
    - Fecha o rango de fechas de la venta (`fechanvt`), con atajos Hoy / Esta semana / Este mes; **por defecto: mes en curso**
      (hora de Chile).
    - Estado: Todas / Pendientes de facturar / Facturadas (traspaso hecho).
    - Empresa: Todas / Vida Digital / SANJH (la columna Empresa es pedido de Pablo; el filtro es comodidad).
B4. **Filtros persistentes por usuario:** se guardan por usuario (en la base, no solo en el navegador) y se restauran al volver a
    la pantalla, desde cualquier equipo.
B5. Clic en una venta (pendiente o facturada) → **modal** con cabecera (Empresa, nota, cliente, vendedor, fecha, estado, visación,
    total) y tabla de líneas: **IMAGEN | CÓDIGO | COSTO | % SOBRE EL COSTO | CANTIDAD (cajas) | PRECIO DE VENTA | GANANCIA USD**,
    con total de ganancia al pie.
B6. **Informe de comisiones mensual:** por mes de **facturación** (`fechadoc`), una fila por vendedor válido: N° de notas
    facturadas, total vendido (suma de `val_rea`), % de comisión, comisión (USD) = total vendido × %. Solo notas facturadas.
    Total general al pie. Se puede elegir el mes (por defecto el mes en curso).
B7. **% de comisión único para todos**, configurable por un admin desde el módulo, **predeterminado 0,5%**. Se guarda en la base.
B8. **Exportar el informe a .xlsx** (columnas iguales a la pantalla; hoja con el mes en el nombre del archivo).
B9. Todo el módulo ignora notas con fecha de venta futura, notas pendientes sin líneas y los vendedores excluidos.

## 5. Qué NO es parte del MVP
- Pagar comisiones, marcarlas como pagadas o llevar historial de pagos.
- Porcentajes de comisión distintos por vendedor o por producto.
- Editar ventas o notas (todo es lectura de WinFac).
- Ver ganancias o comisiones con rol vendedor.
- Limpiar en WinFac las notas con fecha futura.
- Corregir las líneas duplicadas de WinFac (ver Riesgos).

## 6. Integraciones externas
Ninguna nueva. Lectura de la réplica WinFac en Neon; imágenes ya en Cloudinary (`productos.imagen_url`); export .xlsx con lo que
ya use el repo (`lib/excel.ts`, verificar en Fase A).

## 7. Restricciones
- Stack del repo (Next.js 14 App Router, next-auth v4, Neon `sql`, Tailwind + shadcn/ui, Jest). Sin dependencias nuevas salvo que
  la Fase A lo justifique.
- Esquemas `vida` y `sanjh`: solo lectura, sin cambios de estructura. Tablas nuevas solo en `public`.
- Fechas y horas en hora de Chile con `lib/fechas.ts`; nada de `new Date()`/`toLocale*` durante el render (BUGS.md D3).
- Página privada: validar sesión **y rol admin** en la page y en cada API (BUGS.md D1/D2: rutas con extensión no pasan por el
  middleware). Agregar `/vendedores` a `RUTAS_POR_ROL.admin` y a `humoProd` en `.pbravot/qa-entorno.json`.
- Cada slice nace bajo feature flag en `config/feature-flags.json` (false) y ≤200 líneas.

## 8. Escala
5 vendedores; ~1.900 notas/año (vida ~1.500, sanjh ~350 en 2026). Rango típico: un mes (~150-200 notas). Paginación o
virtualización no es necesaria para un mes; sí para rangos largos (Fase A decide: paginar a partir de N filas).

---

## Flujos críticos y criterios de aceptación

### R1 — Ver el detalle de las ventas registradas de un producto (riesgo: medio)
- Rol: admin o vendedor
- Dado: un producto en /precios cuyo drawer muestra "N ventas registradas" con N > 0
- Cuando: hace clic en "N ventas registradas"
- Entonces: ve una lista con exactamente N filas; cada fila muestra el cliente de la nota de venta y el precio de venta, además de
  la fecha, la nota, el vendedor y la cantidad; ordenadas de la más reciente a la más antigua

### R2 — Producto sin ventas (riesgo: bajo)
- Rol: admin o vendedor
- Dado: un producto con "0 ventas registradas" (o sin ese texto)
- Cuando: abre el drawer
- Entonces: no hay enlace clickeable de ventas y no aparece ningún error

### R3 — Solo el administrador ve el módulo VENDEDORES (riesgo: alto)
- Rol: vendedor y bodeguero
- Dado: sesión iniciada
- Cuando: mira el menú y escribe /vendedores en la barra de direcciones
- Entonces: no ve la opción VENDEDORES en el menú y no ve la pantalla (termina en una pantalla de su rol)

### R4 — Admin ve la tabla de ventas del mes en curso (riesgo: alto)
- Rol: admin
- Dado: sesión iniciada
- Cuando: hace clic en VENDEDORES (a la derecha de ADMINISTRACIÓN) por primera vez
- Entonces: ve la tabla de notas de venta del mes en curso de ambas empresas, con la columna Empresa, el estado (Pendiente /
  Facturada) y el número de visación en las facturadas; no aparecen ventas de PABLO BRAVO, EMPRESA ni sin vendedor, ni notas con
  fecha posterior a hoy

### R5 — Filtros por vendedor, fecha y estado (riesgo: medio)
- Rol: admin
- Dado: la tabla de VENDEDORES
- Cuando: elige un vendedor, un rango de fechas y "Pendientes de facturar" (y luego "Facturadas")
- Entonces: la tabla muestra solo notas de ese vendedor, dentro del rango, con el estado elegido; con "Facturadas" todas tienen
  número de visación y con "Pendientes" ninguna lo tiene

### R6 — Filtros persistentes por usuario (riesgo: medio)
- Rol: admin
- Dado: el admin cambió los filtros de VENDEDORES
- Cuando: sale a otra pantalla y vuelve (o cierra sesión, vuelve a entrar y abre VENDEDORES)
- Entonces: los filtros siguen como los dejó; otro admin que entra ve sus propios filtros, no los del primero

### R7 — Detalle de una venta en modal (riesgo: medio)
- Rol: admin
- Dado: una nota facturada en la tabla (y luego una pendiente con productos)
- Cuando: hace clic en la fila
- Entonces: se abre un modal con la empresa, la nota, el cliente, el vendedor y una tabla con IMAGEN, CÓDIGO, COSTO, % SOBRE EL
  COSTO, CANTIDAD (cajas), PRECIO DE VENTA y GANANCIA USD por línea, y el total de ganancia; el % y la ganancia coinciden con
  (precio − costo) de cada línea

### R8 — Informe de comisiones del mes (riesgo: alto)
- Rol: admin
- Dado: el informe de comisiones con un mes elegido
- Cuando: lo abre
- Entonces: ve una fila por vendedor (sin PABLO BRAVO, EMPRESA ni vacío) con N° de notas facturadas en ese mes de facturación,
  total vendido, % de comisión y comisión = total vendido × %; solo cuentan notas facturadas; el total general cuadra con la
  suma de las filas

### R9 — Configurar el % de comisión (riesgo: medio)
- Rol: admin
- Dado: el % de comisión está en 0,5% (valor por defecto)
- Cuando: lo cambia (ej. a 1%) y guarda
- Entonces: el informe recalcula todas las comisiones con el nuevo % y el valor se mantiene al recargar la pantalla

### R10 — Exportar el informe a Excel (riesgo: medio)
- Rol: admin
- Dado: el informe de comisiones de un mes en pantalla
- Cuando: pulsa Exportar
- Entonces: se descarga un archivo .xlsx con el mes en el nombre y las mismas filas, columnas y totales que muestra la pantalla

### R11 — Flag apagado (riesgo: alto)
- Rol: admin y vendedor
- Dado: los feature flags del módulo y del drawer en false
- Cuando: usa /precios y el menú
- Entonces: el drawer se comporta como hoy (texto no clickeable) y no existe la opción VENDEDORES

---

## Riesgos técnicos (insumo para Fase B)
- **Multiplicación de filas al unir `productos`:** tiene una fila por ingreso y código; unir por `codigo` duplica líneas
  (verificado: una nota de 6 líneas devolvió líneas repetidas al unir). La imagen se obtiene con subconsulta/`DISTINCT ON`
  (una sola fila por código y empresa).
- **Líneas duplicadas en WinFac:** en 2026, 75 notas de vida y 6 de sanjh tienen `sum(itemdcto.totalrea) > val_rea`. Por decisión
  de Pablo la comisión usa `val_rea`. El modal muestra las líneas tal como vienen y, si su suma no cuadra con el total de la
  nota, muestra un aviso visible ("las líneas no cuadran con el total de la nota").
- **Fechas futuras y de facturación anteriores a la venta:** 27 (vida) y 18 (sanjh) facturadas tienen `fechadoc < fechanvt`; el
  informe va por `fechadoc` (Pablo, pregunta 6), la tabla por `fechanvt`.
- **Dos esquemas idénticos:** consultas a `vida` y `sanjh` unidas con columna empresa; evitar duplicar SQL (Fase A propone).
- **Zona horaria:** "mes en curso", "hoy" y "fecha futura" en hora de Chile (`lib/fechas.ts`), en servidor y cliente.
- **Permisos:** página y APIs nuevas validan rol admin (patrón `lib/roles.ts`).

## Slices sugeridos (≤200 líneas cada uno, cada uno con su Fase E)
1. **S1 — Drawer:** API de detalle de ventas registradas del producto (mismo filtro que `/api/kardex`) + lista clickeable (R1, R2, R11-drawer).
2. **S2 — Módulo base:** ruta `/vendedores` admin, menú, `RUTAS_POR_ROL`, `humoProd`, API de notas con filtros y tabla (R3, R4, R5, R11).
3. **S3 — Filtros persistentes:** tabla `public` de preferencias por usuario + API + restaurar filtros (R6).
4. **S4 — Modal de detalle de venta** (R7).
5. **S5 — Comisiones:** configuración del % (tabla `public`) + informe mensual (R8, R9).
6. **S6 — Exportar .xlsx** (R10).

## Preguntas abiertas (gate humano si aparecen)
- Notas facturadas en moneda distinta de USD (`monedaaa<>'13'`): en 2026 no hay ninguna. Si aparece alguna en el rango, el módulo
  la muestra marcada como "otra moneda" y la excluye de la comisión hasta que Pablo defina.

## Zonas de riesgo conocidas

| Archivo / módulo | Riesgo | Qué no tocar sin revisar |
|-----------------|--------|--------------------------|
| `middleware.ts` (matcher y RUTAS_POR_ROL) | Alto | BUGS.md D1/D2: rutas con extensión no pasan por el middleware; cada page/API privada valida rol |
| `components/TopNav.tsx` | Medio | BUGS.md D3: nada dependiente de la hora en el render |
| `lib/fechas.ts` | Medio | Formato fijo en America/Santiago; no depende del ICU |
| `app/api/kardex/route.ts` | Medio | El conteo "ventas registradas" debe seguir igual al detalle |
| (se completa durante el desarrollo) | | |
