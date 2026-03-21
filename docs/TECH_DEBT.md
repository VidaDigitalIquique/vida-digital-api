# Deuda Técnica — VidaDigital Inventario v2

## Pendientes

### [bodega] LoteBodega no incluye cantcaja
- **Fecha:** 2026-03-18
- **Contexto:** `cantcaja` no existe en la interfaz `LoteBodega` en `types/index.ts`. Actualmente se pasa como prop explícito desde `UbicacionBodegaAgrupada.cantcaja` al componente `LoteEditor`.
- **Impacto:** Si en el futuro se necesita acceder a `cantcaja` desde un lote de forma independiente, habrá que agregarlo a `LoteBodega` y al `JSON_BUILD_OBJECT` del query en `app/api/ubicaciones/route.ts`.
- **Solución sugerida:** Agregar `cantcaja: number` a `LoteBodega` y popularlo desde el JOIN con `productos` en el query de `/api/ubicaciones`.
## Bugfixes exempt from feature flags
- fix: proxy image fetch for Web Share API (CORS issue) — 2026-03-21
