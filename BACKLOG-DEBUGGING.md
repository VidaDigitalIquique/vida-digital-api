# BACKLOG DE DEBUGGING — App Vida Digital

Creado: 2026-11-11 por el Director, desde el humo en produccion `humo-4roles` (commit 0d997ec, revision mecanica sin IA, 4 pasadas: anon PASA, admin PASA, vendedor PASA, bodeguero FALLA).
Va ANTES de construir los modulos nuevos. Protocolo: ~/.claude/PBRAVOT-DEBUGGING.md. Cada fix con Fase E (qa-ciclo.ps1) y, antes del deploy, Senal 3 (UAT de Pablo).
Evidencia: `C:\Users\pablo\Documents\_dt-vida-digital\qa\humo-4roles-<rol>\` y `..\_dt-vida-digital\logs\qa-humo-4roles-<rol>.md`. Pendientes en QA-REGISTRO.md (P-20261111-1108-* y P-20261111-1110-*).
Siempre pasar `-DtDir C:\Users\pablo\Documents\_dt-vida-digital` a los scripts pBravoT.

Orden sugerido: D1 -> D2 -> D3 -> D4 -> D5.

---

## D1 (CRITICA) — El bodeguero puede entrar a /catalogo/admin  [RESUELTO 2026-11-11, ver BUGS.md]
- Pendiente: P-20261111-1110-1. El hook pre-commit bloquea commits mientras siga abierto.
- Evidencia: QA-BOD12.png — el bodeguero (menu solo BODEGA y DEUDAS) ve "Catalogos Personalizados" con el boton "Nuevo Catalogo".
- Causa VERIFICADA en el codigo:
  - `middleware.ts`, matcher `'/((?!api/|login|catalogo|_next/static|_next/image|favicon.ico).*)'` excluye TODO lo que empieza con `catalogo` (para que los catalogos publicos `app/catalogo/[slug]` y `app/catalogo/clientes/[slug]` abran sin login). Asi `/catalogo/admin` y `/catalogo/clientes` quedan sin control de rol.
  - `app/(app)/catalogo/admin/page.tsx` solo exige sesion (`if (!session) return null`), no rol.
- Por revisar en Fase A: `/catalogo/clientes` (QA-BOD13 PASA: termino en /bodega, verificar por que) y si las server actions / rutas /api del catalogo validan el rol en el servidor (si no, el bodeguero podria crear catalogos aunque se oculte la pantalla).
- Roles permitidos segun RUTAS_POR_ROL: admin y vendedor (`/catalogo`).
- Criterio de cierre: humo bodeguero QA-BOD12 PASA, admin y vendedor siguen entrando, catalogos publicos siguen abriendo sin login.

## D2 (MEDIA) — /manifest.json devuelve una redireccion en vez del manifest  [RESUELTO 2026-11-11, ver BUGS.md]
- Evidencia: consola "Manifest: Line: 1, column: 1, Syntax error. (/manifest.json)".
- Causa VERIFICADA: `GET https://vidadigital-inventario-v2.vercel.app/manifest.json` sin sesion -> 307 a `/api/auth/signin?callbackUrl=%2Fmanifest.json`. El matcher del middleware no excluye `manifest.json` (ni otros archivos de `public/`); con sesion, la ruta no esta en RUTAS_POR_ROL y redirige a la primera ruta del rol. `public/manifest.json` existe y `app/layout.tsx` lo declara.
- Revisar tambien los iconos y cualquier archivo de `public/` que la app pida (efecto probable: la app no es instalable como PWA).
- Criterio de cierre: /manifest.json responde 200 application/json con y sin sesion; sin el error en consola.

## D3 (MEDIA) — Errores de hidratacion de React #425/#418/#423 en casi todas las pantallas  [RESUELTO 2026-11-11: TopNav + fechas en render, ver BUGS.md]
- Pendientes: P-20261111-1108-* (registradas por pantalla; son el mismo problema repetido).
- Pantallas: /dashboard, /precios, /ventas/kardex, /bodega, /bodega/despachos, /bodega/registro-notas, /inventario, /despachos, /deseados, /clientes-nuevos, /prenotas, /pettycash, /sueldos, /deudas, /seguimientos, /garantias, /caja-mayor, /catalogo/admin, /catalogo/clientes, /admin/caja-config, /admin/deudas, /admin/importar, /admin/kardex-exclusiones, /admin/subir-imagenes, /admin/usuarios.
- HIPOTESIS (no verificada, debe confirmarse con evidencia antes de tocar): componente compartido `components/TopNav.tsx` ('use client'), lineas 45-48 y 233: `getSaludo()` usa `new Date().getHours()` durante el render. En Vercel el render del servidor corre en UTC y el navegador en Chile (UTC-3): entre ~09:00 y 12:00 / ~17:00 y 20:00 hora Chile el servidor dice un saludo y el navegador otro -> #425 (texto distinto) -> #418 -> #423. Encaja con que aparezca en todas las pantallas con TopNav. Puede haber otras fechas formateadas en render.
- Criterio de cierre: humo admin/vendedor/bodeguero sin errores #418/#423/#425 en consola, probado en un horario donde el saludo difiera entre UTC y Chile.

## D4 (MEDIA) — Error de React #329 en /admin/categorias, /bodega, /deudas  [RESUELTO 2026-11-11 por D3: misma falla de hidratacion, ver BUGS.md]
- Sin causa identificada todavia. Reproducir en dev (mensaje completo, no minificado) antes de cualquier hipotesis.

## D5 (BAJA) — Con rol bodeguero la app llama a APIs de alertas que no le corresponden  [RESUELTO 2026-11-11, ver BUGS.md]
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
## D9 (CRITICA, seguridad) - Repo publico con .env versionado (secretos de produccion expuestos)  [EN PAUSA por decision de Pablo, 2026-11-11 15:33]
- EN PAUSA: Pablo decidio hacerlo AL FINAL, cuando todo este entregado y funcionando. Habia una razon por la que el repo es publico que Pablo no recuerda: averiguarla antes de cambiar la visibilidad. No bloquea el deploy de D1-D5 (ningun commit toca .env).
- Detectado 2026-11-11 por /ponytail-audit (Senal 3) y verificado por el Director: `gh repo view` -> PUBLIC; `git ls-files .env` -> versionado (ultimo commit b0529d4); .gitignore solo excluye `.env*.local`.
- Expuestos en el historial: DATABASE_URL (Neon prod), NEXTAUTH_SECRET, CLOUDINARY_API_SECRET, OPENROUTER_API_KEY, VAPID_PRIVATE_KEY, BCENTRAL_USER/PASS, entre otros.
- Gate humano (credenciales e infraestructura): repo a privado, rotacion de todas las claves y carga en Vercel. Luego slice: `git rm --cached .env` + .gitignore, SOLO despues de confirmar que Vercel tiene todas las variables en su panel.
- Criterio de cierre: repo privado (o sin secretos en el historial), claves rotadas y probadas en produccion (humo 4 roles PASA), .env fuera del indice.

## D10 (BAJA, deuda) - Items no criticos del /ponytail-audit de la Senal 3 (2026-11-11)
- AlertasContext: al cerrar sesion los contadores no vuelven a 0 hasta recargar; ROLES_ALERTAS/ROLES_SEGUIMIENTOS duplican las listas de las APIs (mover a lib/roles.ts).
- middleware.ts: MATCHER_PATTERN existe solo para un test de identidad (se puede simplificar). Regla a escribir en CLAUDE.md: toda pagina privada con segmento dinamico valida rol en la page (el matcher excluye rutas con extension).
- Fechas con new Date()/toLocale* en garantias, seguimientos, admin/deudas, prenotas, caja-mayor, sueldos: el audit dice que causan hidratacion, pero el barrido del Director (servidor TZ=Asia/Tokyo, dev y build de produccion, 45 pantallas x roles) no mostro errores: se renderizan con datos cargados en el cliente. Riesgo latente: si pasan a renderizarse en el servidor, usar lib/fechas.ts.
- 9 errores de tsc preexistentes en tests ocultos por typescript.ignoreBuildErrors.
## D11 (MEDIA, datos) - Imagenes de productos que no existen en Cloudinary (404)
- Detectado 2026-11-11 en el humo de produccion con IA (prod-2ac571c-1552-admin-ia): 156 URLs distintas `res.cloudinary.com/dxkidwxjl/image/upload/productos/<codigo>.jpg` responden 404 (pendientes P-20261111-1600-*, cerrados como BACKLOG D11).
- Preexistente: la UI pide la imagen por codigo de producto aunque no se haya subido. No lo introdujo el release D1-D5.
- Por revisar: que pantalla las pide (listados de productos), si conviene mostrar un placeholder sin pedir la URL (o usar un fallback de Cloudinary) y/o subir las imagenes faltantes (/admin/subir-imagenes). Decision de producto: como mostrar productos sin imagen.
## D12 (MEDIA) - Seguimientos muestra el cliente de la nota y el de la factura al reves
- Detectado 2026-11-11 al armar el PRD de VENDEDORES. Pablo confirmo que el cliente de la nota de venta es `movidcto.cliente` (ej. nota SANJH 003816: "DILIP MAYANI").
- `app/api/seguimientos/route.ts` toma como cliente `clientes(kcodclie).nombress` ("IMPORT EXPORT VED SPA" en esa nota) y como `factura_nombre` `clientes(kcodcli2)` ("DILIP MAYANI"). Datos: `movidcto.cliente` coincide con el nombre de `kcodcli2` en el 98% de las notas.
- CONFIRMADO por Pablo (2026-11-11 17:18, 6 ejemplos reales): el cliente real (comprador) es ``movidcto.cliente`` = ``clientes(kcodcli2)``; el de factura es ``clientes(kcodclie)``. Seguimientos los tiene invertidos. Criterio de cierre: en Seguimientos, nota SANJH 003816 muestra cliente "DILIP MAYANI" y factura "IMPORT EXPORT VED SPA".

## D13 (MEDIA, datos) - La replica trae lineas de nota que no estan en la nota real de WinFac
- Detectado 2026-11-11 (PRD VENDEDORES). Nota Vida 002499 impresa (JOHN HUARACHI): solo HS-30 y HS-30C, total 2.550. En `vida.itemdcto` la nota tiene ademas 303, BKJ-61 y BJ-96 (181,50, `knumdocu` vacio).
- Alcance 2026: 75 notas vida y 6 sanjh con suma de lineas > `val_rea`. Sin regla en los datos que las separe (cruzar por id_tdocu o knumdocu no generaliza).
- Hipotesis (no verificada): el sync Python WinFac -> Neon inserta/actualiza lineas pero no borra las que se quitaron de la nota en WinFac.
- Impacto: el conteo "ventas registradas" del drawer y las lineas del modal de VENDEDORES pueden incluir productos que no se vendieron. Comision no afectada (usa val_rea).
- Siguiente paso: revisar el script de sync y comparar una nota con el DBF de WinFac.- 2026-11-11 17:24 (Chile): Pablo sincronizo (sync_requests id 59, completado en 36 s). La nota 002499 sigue en produccion con las 5 lineas y val_rea 2550; notas 2026 con lineas de mas: 75 (igual). Sincronizar no lo corrige.
- Hipotesis a verificar en el script de sync (fuera de este repo, ubicacion pendiente de Pablo): (1) el sync hace upsert de lineas y nunca borra; (2) los DBF de WinFac conservan las lineas eliminadas con marca de borrado hasta compactar y el lector no la filtra.
