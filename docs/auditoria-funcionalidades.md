# Auditoría de Funcionalidades

## Alcance y fuentes
Esta auditoría se construyó leyendo:
- Estructura de `app/(app)`
- Navegación y visibilidad por rol en `components/TopNav.tsx` y `components/BottomNav.tsx`
- Páginas cliente solicitadas (y `page.tsx` cuando aplica para guardas de rol)
- Endpoints de `app/api/**/route.ts`
- Pruebas existentes (`*.test.ts`, `*.test.tsx`, `*.spec.ts`) fuera de `node_modules`

---

## Dashboard
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Resumen general (KPIs por empresa) | Muestra métricas de productos por empresa (total, con stock, nuevos, sin precio, última importación) y despachos diarios. | Cualquier usuario autenticado (sin guarda explícita de rol en `dashboard/page.tsx`) | Carga inicial server-side por SQL directo; detalle usa `/api/dashboard/stock-detail` | Sí: `app/(app)/dashboard/client_page.test.tsx`, `__tests__/dashboard-client.test.tsx`, `__tests__/dashboard-stock-compare.test.tsx`, `__tests__/dashboard-despachos.test.ts[x]` |
| Detalle comparación stock | Abre drawer con productos con sobrante/faltante por empresa. | Igual que dashboard | `/api/dashboard/stock-detail?empresaId=&tipo=` | Sí (tests de dashboard stock compare) |
| Modal de despachos del día | Visualiza imagen y datos de despachos cargados hoy. | Igual que dashboard | Sin endpoint extra en cliente (datos iniciales server-side) | Sí (tests de dashboard despachos) |

## Ventas: Sala de Venta (`/precios`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Búsqueda de productos | Busca por código/descripción con debounce, mínimo 2 caracteres. | `admin`, `vendedor` (menú) | `/api/productos?search=...` | Parcial: `__tests__/precios-api-empresa.test.ts`, `__tests__/precios-card-badge.test.tsx`, `components/ProductDrawer.test.tsx` |
| Filtros y visualización | Filtros “solo stock”, “solo nuevos”, ocultar/mostrar precios; persistencia en localStorage. | `admin`, `vendedor` | `/api/productos` con flags (`soloStock`, `soloNuevo`) | Parcial |
| Drawer de producto | Detalle/edición contextual por producto. | `admin`, `vendedor` | APIs internas del `ProductDrawer` (component-level), y actualización local de lista | Sí: `components/ProductDrawer.test.tsx` |

## Ventas: Kardex Cliente (`/ventas/kardex`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Búsqueda de clientes | Busca clientes WinFac por nombre/código con filtros (ciudad, país, estrellas). | `admin`, `vendedor` (menú) | `/api/ventas/clientes`, `/api/ventas/clientes/opciones` | Sí: `app/api/ventas/clientes/route.test.ts`, `app/api/ventas/clientes/opciones/route.test.ts`, `__tests__/kardex-api.test.ts` |
| Kardex por cliente | Consulta historial de compras, precios y stock por producto del cliente. | `admin`, `vendedor` | `/api/ventas/clientes/[kcodclie]/kardex`, `/api/kardex` | Sí: `app/api/ventas/clientes/[kcodclie]/kardex/route.test.ts`, `__tests__/kardex-api.test.ts` |
| Foto cliente | Subida de foto de cliente desde la vista kardex. | `admin`, `vendedor` | `/api/ventas/clientes/[kcodclie]/foto` | Cobertura no encontrada específica |
| Acciones comerciales desde kardex | Permite agregar producto a Deseados y a Pre-Nota desde cada tarjeta. | `admin`, `vendedor` (en UI, “Agregar a Pre-Nota” oculto para bodeguero) | Modal Deseados/Pre-Nota usa APIs de sus módulos (`/api/deseados`, `/api/prenotas/*`) | Parcial por módulos relacionados |

## Ventas: Pre-Notas (`/prenotas`, `/prenotas/[id]`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Listado y creación de pre-notas | Lista borradores, crea nueva pre-nota y abre detalle. | Todos excepto `bodeguero` (guardado en `page.tsx`) | `/api/prenotas` (GET, POST), `/api/prenotas/[id]` (DELETE) | Sí: `__tests__/prenotas-page.test.tsx`, `__tests__/api/prenotas.test.ts` |
| Gestión detalle pre-nota | Asigna/quita cliente, edita ítems, elimina ítems, exporta Excel/PDF, comparte WhatsApp. | Todos excepto `bodeguero` | `/api/prenotas/[id]`, `/api/prenotas/[id]/items`, `/api/prenotas/[id]/items/[itemId]`, `/api/ventas/clientes` | Sí: `__tests__/prenota-detalle.test.tsx`, `__tests__/AgregarAPrenotaModal.test.tsx`, `__tests__/api/prenotas.test.ts` |

## Ventas: Clientes Nuevos (`/clientes-nuevos`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| ABM de clientes externos | Crear, editar, eliminar, buscar clientes deseados (externos, no WinFac). | `admin`, `vendedor`, `supervisor` (guarda explícita) | `/api/clientes-deseados`, `/api/clientes-deseados/[id]` | Sí: `__tests__/clientes-nuevos-page.test.tsx`, `__tests__/api/clientes-nuevos-filtro.test.ts` |
| Flujo “crear y agregar deseado” | Crea cliente y abre modal para registrar deseado al cliente recién creado. | mismos roles | `/api/clientes-deseados` + flujo modal de `/api/deseados` | Parcial |
| Sugerencias de conversión | Lista sugerencias WinFac→Lead, aprobar/rechazar/descartar. | mismos roles | `/api/conversion-sugerencias`, `/api/conversion-sugerencias/[id]` | Sí: `__tests__/conversion-sugerencias-ui.test.tsx`, `__tests__/api/conversion-sugerencias.test.ts` |

## Deseados (`/deseados` y `?modo=china`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Gestión de deseos por estado | Lista por tabs (`pendiente`, `avisado`, `descartado`), búsqueda y agrupación por cliente. | `admin`, `vendedor` (menú); página sin guarda adicional | `/api/deseados`, `/api/deseados/[id]` | Cobertura directa no encontrada |
| Alta de deseo (wizard) | Modal en 2 pasos (cliente + producto), soporta cliente WinFac o nuevo y producto con código o libre (China). | `admin`, `vendedor` | `/api/ventas/clientes`, `/api/clientes-deseados`, `/api/productos`, `/api/deseados` | Parcial por APIs relacionadas |
| Aviso/descartar/eliminar | Marcar avisado con comentario, descartar, eliminar registro. | todos con acceso a módulo; eliminar efectivo según backend | `/api/deseados/[id]` | Cobertura directa no encontrada |
| Subida de imagen de deseo | Adjunta foto a ítem deseado. | `admin` según UI actual | `/api/deseados/upload` | No evidencia específica |
| Alertas de stock bajo (modo China) | Lista alertas, permite pedir producto, ignorar o no reponer. | `admin`, `vendedor` (en flujo Catálogo/China) | `/api/alertas-stock/lista`, `/api/alertas-stock/[id]` | Cobertura directa no encontrada |

## Catálogo: Crear Catálogo (`/catalogo/admin`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| ABM de catálogos | Lista, crea, elimina catálogos personalizados; genera y descarga QR; copia link. | `admin`, `vendedor` | `/api/catalogos?empresa=`, `/api/catalogos/[id]`, `/api/catalogos/public/[slug]` | Sí: `app/(app)/catalogo/admin/client_page.test.tsx`, múltiples `__tests__/catalogo-*.test.*`, `__tests__/catalogos-*.test.ts` |
| Edición de productos de catálogo | Abre modal de edición, remueve productos y persiste exclusiones. | `admin`, `vendedor` (propietario según UI) | `/api/catalogos/public/[slug]`, `/api/catalogos/[id]` (PUT) | Parcial (catalog tests amplios) |

## Catálogo: Catálogos por Cliente (`/catalogo/clientes`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Generación de catálogo por historial cliente | Busca cliente WinFac, crea catálogo personalizado por regla de precio y stock, opción ambas empresas. | `admin`, `vendedor` (guarda explícita) | `/api/ventas/clientes`, `/api/catalogos/cliente`, `/api/catalogos/[id]` | Sí parcial: `__tests__/catalogos-cliente-api.test.ts`, `__tests__/catalogos-filtros.test.ts`, `__tests__/catalogos-user-scope.test.ts` |
| Operación de links/QR | Ver catálogo público, abrir versión PDF (`?print=1`), copiar enlace, descargar QR. | mismos roles | Consumo de URL pública de catálogo + APIs anteriores | Parcial |

## Administración: Categorías (`/admin/categorias`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Clasificación de productos por drag & drop | Mueve uno o varios productos entre categorías, incluye filtro de categoría y búsqueda. | `admin`, `supervisor`, `vendedor` (guarda explícita) | `/api/admin/productos-lista`, `/api/productos/[id]`, `/api/categorias`, `/api/categorias/[id]` | Sí: `__tests__/admin-productos-lista.test.ts`, `__tests__/api/categorias.test.ts`, `__tests__/api/categorizar-productos.test.ts`, `__tests__/productos-put-categoria*.test.ts` |
| Gestión de categorías | Crear y eliminar categorías; actualizar conteos. | mismos roles | `/api/categorias`, `/api/categorias/[id]` | Sí |
| Atajo a catálogo por categoría | Abre diálogo para crear catálogo prefiltrado por categoría. | mismos roles | flujo hacia `/api/catalogos*` | Parcial |

## Bodega: Ubicaciones (`/bodega`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Consulta rápida de ubicación/código | Búsqueda con filtros por stock/nuevos; muestra tarjetas por código/lote. | `admin`, `bodeguero` (menú) | `/api/ubicaciones` | Sí: `app/(app)/bodega/client_page.test.tsx`, `__tests__/bodega-client_page.test.tsx`, `__tests__/api/ubicaciones-id.route.test.ts`, `__tests__/sync-ubicaciones.test.ts` |
| Edición de lote en drawer | Edita ubicación física, cajas/unidades físicas y observaciones; calcula diferencias. | mismos roles | `/api/ubicaciones/[id]` | Sí parcial (API + UI bodega) |

## Bodega: Despachos (`/bodega/despachos`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Búsqueda de despacho por folio | Consulta si una nota ya fue despachada y muestra evidencia fotográfica. | `admin`, `bodeguero` (subida); visualización según acceso a módulo | `/api/despachos/buscar` | Sí: `app/(app)/bodega/despachos/client_page.test.tsx`, `__tests__/shipment-logic.test.ts`, `__tests__/dashboard-despachos.test.ts[x]` |
| Registro de despacho con cámara | Cola de imágenes, compresión en cliente y OCR/procesamiento en backend para registrar folio. | `admin`, `bodeguero` | `/api/despachos/procesar` | Parcial (shipment logic) |
| Compartir evidencia | Comparte imagen de despacho por Web Share/WhatsApp. | `admin`, `bodeguero` | no API adicional (usa `imagen_url` de resultado) | Sin evidencia específica |

## Bodega: Registro de Notas (`/bodega/registro-notas`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Registro de custodia de notas | Alta de nota con empresa y observación; listado con filtros por folio/fecha. | Página accesible a autenticados; eliminar restringido a `admin` en UI/API | `/api/bodega/registro-notas` | Sí: `app/api/bodega/registro-notas/route.test.ts` |
| Eliminación con auditoría | Admin elimina registro desde modal con observación; backend audita en `app_audit_log`. | `admin` | `/api/bodega/registro-notas/[id]` | Cobertura parcial (test actual de `route.ts`; no test específico de DELETE `[id]`) |

## Administración: Usuarios (`/admin/usuarios`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Gestión de cuentas y permisos | Crear/editar/eliminar usuarios, activar/bloquear, rol y empresas permitidas. | Solo `admin` (guarda SSR) | `/api/admin/usuarios`, `/api/admin/usuarios/[id]` | No se encontró test específico directo |

## Administración: Sincronizar WinFac (`/admin/importar`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Sincronización automática/forzada | Dispara sincronización remota y actualización en BD local. | `admin`, `supervisor` (guarda SSR) | `/api/admin/trigger-sync`, `/api/admin/sync-from-winfac` | Sí: `__tests__/sync-from-winfac.test.ts` |
| Importación manual por Excel | Parsea excel local, detecta empresa, valida y sube en bloques. | `admin`, `supervisor` | `/api/admin/importar` | Sí: `__tests__/importar-empresa-autodetect.test.ts` |

## Administración: Subir Imágenes (`/admin/subir-imagenes`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Carga masiva de imágenes | Sube lote de imágenes por código de producto (nombre de archivo). | `admin`, `supervisor` | `/api/productos/upload` | Sí: `app/api/productos/upload/route.test.ts` |

## Administración: Exclusiones Kardex (`/admin/kardex-exclusiones`)
| Funcionalidad | Qué hace exactamente | Roles con acceso | Endpoints API usados | ¿Tiene tests? |
|---|---|---|---|---|
| Gestión de patrones excluidos | Alta, baja y activación/inactivación de patrones para excluir clientes del cálculo de precios en kardex. | Visible en menú solo `admin`; `page.tsx` actual no aplica guarda SSR explícita | `/api/admin/kardex-exclusiones` | No se encontró test específico directo |

---

## Resumen de roles y accesos (menú)
| Rol | Módulos visibles en menú |
|---|---|
| `admin` | Ventas (Sala de Venta, Kardex, Pre-Notas, Clientes Nuevos), Catálogo (Crear Catálogo, Catálogos por Cliente, Categorías, Pedir a China), Bodega (Ubicaciones, Despachos, Registro de Notas), Deseados, Administración (Sincronizar WinFac, Subir Imágenes, Usuarios, Exclusiones Kardex). |
| `vendedor` | Ventas (Sala de Venta, Kardex, Pre-Notas, Clientes Nuevos), Catálogo (Crear Catálogo, Catálogos por Cliente, Categorías, Pedir a China), Deseados. |
| `supervisor` | En menú móvil: Ventas (Clientes Nuevos). En rutas: también puede acceder a `admin/categorias`, `admin/importar`, `admin/subir-imagenes` por guardas SSR. |
| `bodeguero` | Bodega (Ubicaciones, Despachos, Registro de Notas). |

Notas de guarda por ruta:
- Hay módulos con control por menú y además guarda SSR (`prenotas`, `clientes-nuevos`, `catalogo/clientes`, `admin/*` parcialmente).
- `dashboard`, `precios`, `ventas/kardex`, `deseados`, `bodega` y `bodega/despachos` dependen más del acceso general/autenticación y visibilidad de navegación.

---

## Endpoints API completos agrupados por dominio

### `admin`
- `app/api/admin/categorizar-productos/route.ts`
- `app/api/admin/importar/route.ts`
- `app/api/admin/kardex-exclusiones/route.ts`
- `app/api/admin/productos-lista/route.ts`
- `app/api/admin/sync-from-winfac/route.ts`
- `app/api/admin/trigger-sync/route.ts`
- `app/api/admin/usuarios/route.ts`
- `app/api/admin/usuarios/[id]/route.ts`

### `alertas-stock`
- `app/api/alertas-stock/route.ts`
- `app/api/alertas-stock/lista/route.ts`
- `app/api/alertas-stock/[id]/route.ts`

### `auth`
- `app/api/auth/[...nextauth]/route.ts`

### `bodega`
- `app/api/bodega/registro-notas/route.ts`
- `app/api/bodega/registro-notas/[id]/route.ts`

### `catalogos`
- `app/api/catalogos/route.ts`
- `app/api/catalogos/cliente/route.ts`
- `app/api/catalogos/cliente/[slug]/route.ts`
- `app/api/catalogos/public/[slug]/route.ts`
- `app/api/catalogos/[id]/route.ts`

### `categorias`
- `app/api/categorias/route.ts`
- `app/api/categorias/[id]/route.ts`

### `clientes`
- `app/api/clientes/[kcodclie]/rating/route.ts`

### `clientes-deseados`
- `app/api/clientes-deseados/route.ts`
- `app/api/clientes-deseados/[id]/route.ts`

### `conversion-sugerencias`
- `app/api/conversion-sugerencias/route.ts`
- `app/api/conversion-sugerencias/[id]/route.ts`

### `cron`
- `app/api/cron/sync-inventar/route.ts`

### `dashboard`
- `app/api/dashboard/stock-detail/route.ts`

### `deseados`
- `app/api/deseados/route.ts`
- `app/api/deseados/alertas/route.ts`
- `app/api/deseados/upload/route.ts`
- `app/api/deseados/[id]/route.ts`

### `despachos`
- `app/api/despachos/buscar/route.ts`
- `app/api/despachos/extract-zip/route.ts`
- `app/api/despachos/procesar/route.ts`
- `app/api/despachos/process/route.ts`

### `inventario`
- `app/api/inventario/route.ts`
- `app/api/inventario/bulk-save/route.ts`

### `kardex`
- `app/api/kardex/route.ts`

### `prenotas`
- `app/api/prenotas/route.ts`
- `app/api/prenotas/[id]/route.ts`
- `app/api/prenotas/[id]/items/route.ts`
- `app/api/prenotas/[id]/items/[itemId]/route.ts`

### `productos`
- `app/api/productos/route.ts`
- `app/api/productos/upload/route.ts`
- `app/api/productos/[id]/route.ts`
- `app/api/productos/[id]/compradores/route.ts`

### `share-image`
- `app/api/share-image/route.ts`

### `ubicaciones`
- `app/api/ubicaciones/route.ts`
- `app/api/ubicaciones/[id]/route.ts`

### `ventas/clientes`
- `app/api/ventas/clientes/route.ts`
- `app/api/ventas/clientes/opciones/route.ts`
- `app/api/ventas/clientes/[kcodclie]/foto/route.ts`
- `app/api/ventas/clientes/[kcodclie]/kardex/route.ts`

---

## Observaciones de auditoría
- `app/(app)/admin/kardex-exclusiones/page.tsx` está implementado como Client Component directo (sin wrapper SSR de rol); la restricción principal hoy está en navegación y en el backend.
- Existe cobertura fuerte en módulos de catálogo, bodega base, dashboard, prenotas y APIs clave de ventas/clientes.
- Cobertura más débil o no evidente en UI de `deseados`, `usuarios` y `registro-notas` (parte de eliminación `[id]`).
