# BUGS.md — Registro de bugs resueltos

---

## [2026-07-02] — Modal editar catálogo muestra todo el inventario en vez de productos filtrados

**Síntoma:** Al hacer clic en "Editar" un catálogo, el modal mostraba todos los productos del inventario. Sin embargo, la página pública del mismo catálogo mostraba correctamente solo los productos filtrados.

**Causa raíz:** `parseKeywords` en `app/api/catalogos/public/[slug]/route.ts` hacía fallback a split-por-espacio cuando el string de filtro no contenía coma. Esto fragmentaba frases multi-palabra como `"Hervidor de Agua"` en tokens sueltos `["Hervidor", "de", "Agua"]`. El token `"de"` actuaba como wildcard porque matchea prácticamente cualquier producto en español. La página pública usaba una función distinta (`parseCSVField` en `page.tsx`) que solo split por coma — por eso funcionaba bien.

**Fix:** Eliminado el fallback a espacio en `parseKeywords`. Ahora solo split por coma, alineado con `parseCSVField`. Agregada normalización de espacios internos (`replace(/\s+/g, ' ')`) para manejar whitespace extra.

**Archivos modificados:**
- `app/api/catalogos/public/[slug]/route.ts` (1 línea)
- `app/api/catalogos/public/[slug]/route.test.ts` (3 tests actualizados)

**Verificación:**
- Script `_verify_fix.ts` simuló ambos code paths (endpoint API con `parseKeywords` fixeado vs página pública con `parseCSVField`) contra la BD real para el catálogo ID 329.
- Ambos devolvieron exactamente los mismos 21 productos.
- Exclusiones (`NAVIDAD`, `(ANIL)`) confirmadas: 0 productos colados.

**Catálogos afectados:** Solo ID 329 (`catalogo-hervidores-con-precios-55345`). Auditoría de los 33 catálogos con filtros activos confirmó que ningún otro tenía múltiples tokens sin coma en `palabras_incluir`.

---

## [2026-07-02] — Tests con mocks insuficientes para `getLatestIngresoRealCodigos` (bug preexistente)

**Síntoma:** `catalogos-filtros.test.ts` y `catalogo-solo-nuevo-fix.test.ts` tenían tests verdes que no detectaban el error real. Descubierto durante Fase C del slice de precio individual (la query extra de `catalogo_precio_override` expuso que los mocks existentes no cubrían todas las queries de `getLatestIngresoRealCodigos`).

**Causa raíz:** `getLatestIngresoRealCodigos` hace 3 queries SQL (anio → folio → codigo) para `topN = 1`, pero los mocks de los tests con `solo_nuevo = true` solo proveían 2 valores para esas 3 queries. El mock `[{ anio: '26', folio: '000001' }]` con ambos campos en una fila hacía que `latestYear[0].anio` funcionara, pero el mock siguiente `[{ codigo: 'A3' }]` se consumía en la query de folio (devolviendo `folio = undefined`), y la query de codigo real quedaba sin mock → `TypeError: codigoRows is not iterable`. Confirmado vía `git stash` + `jest` contra el commit limpio `d272b5a`: ambos tests fallaban antes de este slice.

**Fix:** Reescritos los mocks con entradas separadas para cada query de `getLatestIngresoRealCodigos` (anio, folio, codigo), más la query de `catalogo_precio_override` agregada en este slice. Agregado `solo_nuevo_top_n: 1` a `CATALOGO_BASE` en ambos fixtures.

**Archivos modificados:**
- `__tests__/catalogos-filtros.test.ts`
- `__tests__/catalogo-solo-nuevo-fix.test.ts`
- `__tests__/api/catalogos-categoria.test.ts` (+1 mock para query de overrides)

---

## [2026-07-02] — Guardar con input de precio en "0" dispara error 400 del servidor

**Síntoma:** Al editar un catálogo, borrar el valor de un precio individual carácter por carácter y hacer click en "Guardar" cuando el campo mostraba `0` (estado intermedio antes de vaciarse completamente), el PUT fallaba con error 400. El servidor rechazaba `precio: 0` porque la validación requiere `precio > 0`.

**Causa raíz:** `handleOverrideChange` en `client_page.tsx` solo borraba el override del estado si el valor era `NaN` o string vacío. `parseFloat("0")` retorna `0` — no es `NaN` ni string vacío — así que `0` se persistía en `editOverrides` y se enviaba al PUT como `{codigo: "XXX", precio: 0}`.

**Fix:** Agregado `num <= 0` a la condición de borrado (1 línea en `handleOverrideChange`). `0` y negativos ahora se tratan igual que valor vacío: se elimina el override del estado y no se envía al servidor.

**Archivos modificados:**
- `app/(app)/catalogo/admin/client_page.tsx` (1 línea)
- `__tests__/catalogo-edit-modal.test.tsx` (T9 agregado)

**Verificación:** T9 reproduce el escenario (escribir "0" → guardar → verificar que el código NO aparece en `precio_overrides`). Suite completa 15/15 verde.


---

## [2026-11-11] — D1: el rol bodeguero entra a /catalogo/admin y puede usar las APIs de catalogos

- Tipo: A (visual / permisos de pantalla) + control de acceso en API
- Causa raiz: `middleware.ts` excluye del matcher todo lo que empieza con `catalogo` (para que los catalogos publicos `/catalogo/[slug]` abran sin login), asi que `/catalogo/admin` y `/catalogo/clientes` no pasan por RUTAS_POR_ROL. `app/(app)/catalogo/admin/page.tsx` solo exigia sesion. Ademas las APIs privadas de catalogos (`/api/catalogos` GET/POST, `/api/catalogos/[id]` GET/PUT/DELETE, `/api/catalogos/cliente` GET/POST) validaban sesion y empresa pero no rol: un bodeguero podia crear/borrar catalogos llamando la API directo.
- Fix aplicado: `lib/roles.ts` (`ROLES_CATALOGO` = admin, vendedor; `puedeGestionarCatalogos`). La page de admin redirige a /login sin sesion y a /dashboard con rol no permitido (el middleware lleva al bodeguero a /bodega). Los 7 handlers responden 403 "Rol no autorizado" tras el chequeo de sesion. Tests: lib/roles.test.ts, page.test.tsx y route.test.ts de las 3 rutas (bodeguero 403 sin tocar la base; admin/vendedor siguen; sin sesion 401). Middleware sin cambios.
- Verificacion: jest sin suites nuevas en falla vs 0d997ec (43 preexistentes en ambos); tsc y lint sin errores nuevos en archivos tocados; Fase E bug-d1b PASA 5/5; el Director reprodujo en navegador: bodeguero /catalogo/admin -> /bodega, POST/GET /api/catalogos y GET /api/catalogos/cliente -> 403.
- Zona fragil: cualquier pantalla privada nueva bajo `/catalogo` NO pasa por el middleware: debe validar el rol en la page y en sus APIs (usar `lib/roles.ts`). No ampliar la exclusion `catalogo` del matcher sin revisar esto.
- Commit: el de "fix: D1 bodeguero entra a /catalogo/admin" (ver git log)
---

## [2026-11-11] — D2: /manifest.json e iconos de public/ redirigian al login (PWA no instalable, error "Manifest: Line 1" en consola)

- Tipo: A (visual / consola) por configuracion de rutas
- Causa raiz: el `config.matcher` de `middleware.ts` solo excluia `favicon.ico`; `/manifest.json`, `/icon-192.png` y `/icon-512.png` pasaban por `withAuth`: sin sesion 307 a /api/auth/signin, con sesion redirect a la primera ruta del rol (no estan en RUTAS_POR_ROL). El navegador recibia HTML en vez del manifest.
- Fix aplicado: el matcher excluye ademas cualquier pathname que termine en una extension de archivo estatico (png, jpg, jpeg, gif, svg, webp, ico, json, txt, xml, webmanifest, js, map). `MATCHER_PATTERN` exportado y `__tests__/middleware-matcher.test.ts` (21 tests, incluye que el literal de `config.matcher` sea identico).
- Verificacion: Fase E bug-d2 PASA 5/5; Director: sin sesion manifest/iconos 200, privadas 307 al login, /robots.txt 404; con bodeguero /prenotas/1.json y /seguimientos/1/2.json terminan en /bodega.
- Zona fragil: una URL que termina en esas extensiones NO pasa por el middleware (sin control de rol). Toda pagina privada con segmento dinamico (hoy `/prenotas/[id]` y `/seguimientos/[empresa]/[folio]`) debe validar sesion y rol en la propia page; el layout `(app)` solo exige sesion. No crear rutas de app con esas extensiones.
- Commit: el de "fix: D2 manifest e iconos redirigian al login" (ver git log)