# BACKLOG DE DEBUGGING — App Vida Digital

Creado: 2026-11-11 por el Director, desde el humo en produccion `humo-4roles` (commit 0d997ec, revision mecanica sin IA, 4 pasadas: anon PASA, admin PASA, vendedor PASA, bodeguero FALLA).
Va ANTES de construir los modulos nuevos. Protocolo: ~/.claude/PBRAVOT-DEBUGGING.md. Cada fix con Fase E (qa-ciclo.ps1) y, antes del deploy, Senal 3 (UAT de Pablo).
Evidencia: `C:\Users\pablo\Documents\_dt-vida-digital\qa\humo-4roles-<rol>\` y `..\_dt-vida-digital\logs\qa-humo-4roles-<rol>.md`. Pendientes en QA-REGISTRO.md (P-20261111-1108-* y P-20261111-1110-*).
Siempre pasar `-DtDir C:\Users\pablo\Documents\_dt-vida-digital` a los scripts pBravoT.

Orden sugerido: D1 -> D2 -> D3 -> D4 -> D5.

---

## D1 (CRITICA) — El bodeguero puede entrar a /catalogo/admin
- Pendiente: P-20261111-1110-1. El hook pre-commit bloquea commits mientras siga abierto.
- Evidencia: QA-BOD12.png — el bodeguero (menu solo BODEGA y DEUDAS) ve "Catalogos Personalizados" con el boton "Nuevo Catalogo".
- Causa VERIFICADA en el codigo:
  - `middleware.ts`, matcher `'/((?!api/|login|catalogo|_next/static|_next/image|favicon.ico).*)'` excluye TODO lo que empieza con `catalogo` (para que los catalogos publicos `app/catalogo/[slug]` y `app/catalogo/clientes/[slug]` abran sin login). Asi `/catalogo/admin` y `/catalogo/clientes` quedan sin control de rol.
  - `app/(app)/catalogo/admin/page.tsx` solo exige sesion (`if (!session) return null`), no rol.
- Por revisar en Fase A: `/catalogo/clientes` (QA-BOD13 PASA: termino en /bodega, verificar por que) y si las server actions / rutas /api del catalogo validan el rol en el servidor (si no, el bodeguero podria crear catalogos aunque se oculte la pantalla).
- Roles permitidos segun RUTAS_POR_ROL: admin y vendedor (`/catalogo`).
- Criterio de cierre: humo bodeguero QA-BOD12 PASA, admin y vendedor siguen entrando, catalogos publicos siguen abriendo sin login.

## D2 (MEDIA) — /manifest.json devuelve una redireccion en vez del manifest
- Evidencia: consola "Manifest: Line: 1, column: 1, Syntax error. (/manifest.json)".
- Causa VERIFICADA: `GET https://vidadigital-inventario-v2.vercel.app/manifest.json` sin sesion -> 307 a `/api/auth/signin?callbackUrl=%2Fmanifest.json`. El matcher del middleware no excluye `manifest.json` (ni otros archivos de `public/`); con sesion, la ruta no esta en RUTAS_POR_ROL y redirige a la primera ruta del rol. `public/manifest.json` existe y `app/layout.tsx` lo declara.
- Revisar tambien los iconos y cualquier archivo de `public/` que la app pida (efecto probable: la app no es instalable como PWA).
- Criterio de cierre: /manifest.json responde 200 application/json con y sin sesion; sin el error en consola.

## D3 (MEDIA) — Errores de hidratacion de React #425/#418/#423 en casi todas las pantallas
- Pendientes: P-20261111-1108-* (registradas por pantalla; son el mismo problema repetido).
- Pantallas: /dashboard, /precios, /ventas/kardex, /bodega, /bodega/despachos, /bodega/registro-notas, /inventario, /despachos, /deseados, /clientes-nuevos, /prenotas, /pettycash, /sueldos, /deudas, /seguimientos, /garantias, /caja-mayor, /catalogo/admin, /catalogo/clientes, /admin/caja-config, /admin/deudas, /admin/importar, /admin/kardex-exclusiones, /admin/subir-imagenes, /admin/usuarios.
- HIPOTESIS (no verificada, debe confirmarse con evidencia antes de tocar): componente compartido `components/TopNav.tsx` ('use client'), lineas 45-48 y 233: `getSaludo()` usa `new Date().getHours()` durante el render. En Vercel el render del servidor corre en UTC y el navegador en Chile (UTC-3): entre ~09:00 y 12:00 / ~17:00 y 20:00 hora Chile el servidor dice un saludo y el navegador otro -> #425 (texto distinto) -> #418 -> #423. Encaja con que aparezca en todas las pantallas con TopNav. Puede haber otras fechas formateadas en render.
- Criterio de cierre: humo admin/vendedor/bodeguero sin errores #418/#423/#425 en consola, probado en un horario donde el saludo difiera entre UTC y Chile.

## D4 (MEDIA) — Error de React #329 en /admin/categorias, /bodega, /deudas
- Sin causa identificada todavia. Reproducir en dev (mensaje completo, no minificado) antes de cualquier hipotesis.

## D5 (BAJA) — Con rol bodeguero la app llama a APIs de alertas que no le corresponden
- Pendientes: P-20261111-1110-2..4. Consola: 401 en /api/deseados/alertas y /api/alertas-stock; 403 en /api/seguimientos/alertas.
- Probable: un componente compartido (TopNav u otro) pide las alertas sin mirar el rol. Verificar en el codigo.
- Criterio de cierre: con bodeguero no se hacen esas llamadas (o no generan error).

---

Al cerrar cada item: commit con causa raiz, entrada en BUGS.md, cerrar el pendiente en QA-REGISTRO.md (ARREGLADO/BACKLOG/DESCARTADO) y registrar en AUTO-LOG.md.
## D6 (ALTA) - Un test de jest escribe en la base de PRODUCCION
- Detectado 2026-11-11 por el Director durante D1 (informe del Programador bug-d1-1).
- Causa VERIFICADA: `__tests__/catalogo-precio-override.test.ts` no mockea `sql` ("usan BD real"); `next/jest` carga `.env` y `DATABASE_URL` es produccion. En `beforeAll` hace INSERT de 2 catalogos y overrides; `afterAll` los borra. Cualquier `npm test` (incluido verificar.ps1) escribe y borra en produccion.
- Estado tras la corrida de hoy (consulta de solo lectura): sin catalogos de test residuales ni overrides huerfanos.
- Mitigacion mientras tanto: el Director corre jest con `--testPathIgnorePatterns catalogo-precio-override`.
- Criterio de cierre: ningun test puede conectarse a `DATABASE_URL` de produccion (usar `TEST_DATABASE_URL` con guarda, o mocks); `npm test` completo no toca produccion.

## D7 (BAJA, solo dev) - /favicon.ico responde 500 en desarrollo
- Detectado en Fase E bug-d1b (EXP-2). Causa VERIFICADA: existen `app/favicon.ico` y `public/favicon.ico`; Next dev responde 500 por archivo publico y de app en conflicto. Produccion responde 200 (medido 2026-11-11).
- Criterio de cierre: /favicon.ico 200 en dev y prod (dejar un solo archivo).

## D8 (MEDIA) - Warning "Function components cannot be given refs" en consola de dev
- Detectado en Fase E bug-d1b (consola). Pista de la Fase E bug-d2 (EXP-3, sin verificar): "Check the render method of `BodegaClient`", en `components/ui/input.tsx` (Input sin forwardRef). Verificar en el codigo antes de cualquier hipotesis.