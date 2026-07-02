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

