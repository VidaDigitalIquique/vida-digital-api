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

