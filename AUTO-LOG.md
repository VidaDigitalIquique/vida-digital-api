# AUTO-LOG — vida-digital-api

## 2026-11-11 — Preparacion de QA pBravoT
- CLAUDE.md del proyecto, .pbravot/qa-entorno.json (entorno :3124 + humoProd 26 pantallas x 3 roles), qa-preparar.mjs, qa-datos.md.
- Humo en produccion (sin sesion): PASA 27/27. Pasadas por rol pendientes de la sesion de Pablo por rol.
- Pendiente: base de pruebas (rama Neon) y PRD.md de los modulos nuevos con criterios R<n>.

## 2026-11-11 - Slice: debugging D1 (bodeguero en /catalogo/admin, CRITICA)
- Programador: deep (deepseek-flash, effort low), bug-d1-1, 708 s, 1.76 USD
- Contrato: hipotesis del Director (matcher excluye catalogo + page y 7 handlers sin rol) -> guarda por rol en page y APIs con lib/roles.ts
- Tests: 5 suites nuevas (42 tests) ROJO->VERDE; jest completo sin fallas nuevas vs 0d997ec (Director, con catalogo-precio-override excluido por D6)
- Commit: "fix: D1 bodeguero entra a /catalogo/admin" (ver git log)
- Gates disparados: 1 (infraestructura): la rama Neon de pruebas estaba vacia (0 tablas); Pablo inicio sesion en Neon y el Director reseteo development desde production (restore via API de la consola)
- QA (Fase E): bug-d1 BLOQUEADO x2 (cuentas QA qa-<rol> no pasan formatRut del login) -> qa-preparar con RUT 99.999.99x-x -> bug-d1b PASA 5/5; Director reprodujo QA-D1-01 y POST a la API (403)
- Desvios del Programador: corrio jest completo, que incluye un test que escribe en produccion (preexistente; sin residuos verificado) -> D6 en backlog; prompts siguientes prohiben jest sin filtro
- Hallazgos nuevos: D6 (alta, test escribe en prod), D7 (baja, favicon 500 solo dev), D8 (media, warning forwardRef)
- QA metricas: FP 0, ESC 0, ACIERTOS 0 (en este slice; el bug lo encontro el humo previo), costo QA 0.52 USD conocido (bug-d1 2a corrida 0.14 + bug-d1b 0.38; la 1a corrida de bug-d1 quedo sin costo: el reintento sobrescribe el .done); mejoras de QA aplicadas: proyecto (qa-preparar/qa-datos); semilla PENDIENTE (ver MEJORAS-QA.md)
## 2026-11-11 - Slice: debugging D2 (manifest e iconos redirigian al login, MEDIA)
- Programador: deep (deepseek-flash, effort low), bug-d2-1, 210 s, 0.75 USD
- Contrato: hipotesis del Director (matcher solo excluia favicon.ico) -> excluir archivos con extension estatica del matcher
- Tests: middleware-matcher.test.ts 21/21 VERDE (ROJO previo con evidencia); build y next start de humo OK (Programador); Director corrio el test
- Commit: "fix: D2 manifest e iconos redirigian al login" (ver git log)
- Gates disparados: ninguno
- QA (Fase E): bug-d2 PASA 5/5; Director reprodujo sin sesion y con bodeguero, y probo rutas dinamicas privadas con .json (siguen protegidas por la page)
- Desvios del Programador: ninguno (corrio npm run build con el .env normal antes de instalar MQ-S1; solo lectura)
- QA metricas: FP 0, ESC 0, ACIERTOS 1 (EXP-3 apunto al componente del warning D8), costo QA 0.35 USD; mejoras de QA aplicadas: semilla ddf3889 (MQ-S1: consola agrupada, tests con base de pruebas)
## 2026-11-11 - Slice: debugging D3 + D4 (hidratacion, MEDIA)
- Programador: deep (deepseek-flash, low): bug-d3-1 (TopNav, 194 s, 1.01 USD), bug-d3b-1 + bug-d3b-2 (fechas, ~5 min + 5 min, 3.17 USD acumulado de la sesion)
- Contrato: hipotesis 1 del Director (saludo de TopNav) confirmada con experimento TZ=Asia/Tokyo ("Server: Buenas noches / Client: Buenas tardes"); el barrido posterior revelo 4 fuentes mas (fechas en render) -> D3b; ajuste por espacio U+00A0 de ICU y daysInRange
- Tests: topnav-saludo-hidratacion, saludo-por-hora, fechas-cl, pettycash-dias en VERDE (ROJO previo con evidencia); jest completo contra la base de pruebas sin fallas nuevas
- Commits: "fix: D3 saludo de TopNav ..." y "fix: D3b fechas en hora de Chile ..." (ver git log)
- Gates disparados: ninguno
- QA (Fase E): bug-d3 intento1 INVALIDO (falto una captura; QA-D3-04 BLOQUEADO por caso mal redactado por el Director: pedia la hora del navegador), intento2 PASA 5/5. Director: barridos Playwright en dev y build de produccion con servidor desfasado, 45 pantallas sin errores
- D4: reproducido (#329 en 9 pantallas, build de produccion de 0d997ec) y resuelto por D3 (0 en el build actual): cerrado como misma causa
- Desvios del Programador: en D3b omitio daysInRange aunque estaba en la evidencia citada (corregido con -Resume)
- QA metricas: FP 0, ESC 0, ACIERTOS 0, costo QA 1.17 USD (2 intentos); mejoras de QA aplicadas: semilla d9f1a58 (MQ-S2) y MQ-S3 (conocidos en el encargo)
## 2026-11-11 - Slice: debugging D5 (alertas por rol, BAJA)
- Programador: deep (deepseek-flash, effort low), bug-d5-1, 128 s, 0.68 USD
- Contrato: hipotesis del Director (AlertasProvider sin control de rol) -> condicionar cada fetch al rol de la sesion
- Tests: alertas-context-rol.test.tsx VERDE (ROJO previo); lib/roles.test.ts sigue verde
- Commit: "fix: D5 alertas por rol" (ver git log)
- Gates disparados: ninguno
- QA (Fase E): bug-d5 PASA 3/3, 0 pendientes nuevos; Director verifico la red con bodeguero
- Desvios del Programador: ninguno
- QA metricas: FP 0, ESC 0, ACIERTOS 0, costo QA 0.49 USD; mejoras de QA aplicadas: semilla 96a0c8e (MQ-S3: el agente uso 1 de 10 acciones y no re-reporto conocidos)
## 2026-11-11 - Senal 3 (release D1-D5, commits 56d361b..77baef1)
- /ponytail-audit: VERDE para el diff; AMARILLO global por D9 (repo publico con .env versionado, EN PAUSA por decision de Pablo) y deuda D10.
- Build de produccion: compila sin errores ni warnings (84 paginas); lint omitido por config (preexistente).
- Variables de entorno: ninguna nueva en el diff.
- Barrido mecanico (Playwright, build de produccion, servidor TZ=Asia/Tokyo): 45/45 pantallas x rol sin errores de pagina ni hidratacion.
- Fase E release-20261111 (regresion de D1, D2, D3, D5): 18/18 PASA en 2 intentos; veredicto de auditoria INVALIDO solo por nombres de captura (MQ-S4). Costo 2.55 USD. EXP-1 descartado (por diseno).
- Hueco declarado: no hay PRD.md ni qa-barrido.md: no se pudo correr -Requisitos todos -Barrido.
- Pendiente: UAT de Pablo (gate humano), luego push a main y humo de produccion 4 roles.
## 2026-11-11 - Deploy release D1-D5 (2ac571c) + humo de produccion
- UAT de Pablo: aprobado (15:51). Push 8e74470..2ac571c a main (Vercel).
- Humo qa-prod.ps1 -EsperarDeploy -ConIA: PASA en 7 pasadas (anon 27 casos; admin, vendedor, bodeguero 26 cada uno, sin IA y con IA), 0 errores de consola sin contar favicon. Costo 2.84 USD.
- Confirmado en produccion: D1 (QA-BOD12 /catalogo/admin -> /bodega), D2 (/manifest.json 200), D3/D4 (0 errores React #418/#423/#425/#329 en las 3 cuentas), D5 (bodeguero sin 401/403).
- Pendientes: D6 (test que escribia en prod: mitigado por la semilla), D7, D8, D10 (deuda), D9 EN PAUSA (repo publico + .env).- Humo con IA registro 156 pendientes "404 de imagen de producto en Cloudinary" (uno por imagen): agrupados como D11 (BACKLOG); mejora de QA anotada (agrupar 404 de un mismo host/carpeta).
## 2026-11-11 - Slice: S1 drawer "N ventas registradas" clickeable (PRD v2, R1/R2/R11)
- Programador: deep (deepseek-flash, effort low): s1-A 135 s 1.03 USD; s1-BCD 419 s 3.57 USD
- Contrato: lib/ventas-producto.ts como fuente unica del conteo (/api/kardex, JSON sin cambios) y del detalle (GET /api/kardex/ventas, admin+vendedor); boton con carga perezosa en ProductDrawer; fechaDiaCL; flag drawer-ventas-detalle=false. Produccion 185 lineas netas.
- Tests: 43/43 VERDE en los 5 archivos del slice (ROJO previo con evidencia); jest completo contra la base de pruebas: 3 suites rojas preexistentes (categorias, sync-from-winfac, ventas/clientes kardex), mismas en HEAD sin el slice (Director con stash); tsc/lint sin errores en archivos del slice; build OK sin neondatabase en chunks del cliente
- Commit: 1cf3d60
- Gates disparados: ninguno
- QA (Fase E): s1 PASA 6/6 (flag encendido solo durante QA). Director: paridad /api/kardex vs /api/kardex/ventas en HL-81 (106=106), 1030A, HJH-16, 1020-12V; bodeguero 403, vendedor 200, empresaSlug inyectado 400; flag apagado: el texto sigue como DIV sin boton
- Hallazgos: EXP-1/EXP-2 lineas repetidas -> causa verificada en datos (kdocitem con espacios duplicado) -> D14 BACKLOG; consola favicon/forwardRef -> D7/D8
- Desvios del Programador: ninguno
- QA metricas: FP 0, ESC 0, ACIERTOS 1 (EXP-1/2 destaparon D14), costo QA 1.14 USD; mejoras de QA: FRIC anotada (qa-ciclo no tiene parametro para encender un flag solo durante la Fase E; el Director lo edita a mano y lo revierte)

## 2026-11-11 - Slice: S2 modulo VENDEDORES base (S2a API + S2b pantalla/menu; R3/R4/R5/R11)
- Programador: deep (deepseek-flash, effort low): s2-A 1.29 USD; s2a-BCD 310 s 4.19 USD; s2b-BCD 478 s 7.43 USD
- Contrato: lib/vendedores-notas.ts (SQL por esquema desde mapa fijo, parametros posicionales, exclusiones del PRD), GET /api/vendedores/notas (401/403/404 flag/400), /vendedores admin con menu (TopNav + BottomNav), RUTAS_POR_ROL.admin, humoProd. Decisiones del Director: semana = lunes a hoy; limit 300 (max 500) con aviso; visacion fuerza Facturadas; solo rango de visacion = sin limite de fecha de venta (correccion del Director a S2a por R5)
- Lineas: S2a 255 (commiteado en 2 partes); S2b ~303, VendedoresClient 255: excede 200, aceptado por el Director (partir dejaba una pantalla sin filtros). Desvio de la regla 4 declarado
- Tests: 103/103 VERDE en los archivos del slice (ROJO previo); jest completo: solo fallas preexistentes (sync-from-winfac, ventas/clientes kardex); build OK
- Verificacion propia: consulta SQL independiente del Director = API real (nov 2026: 86 notas, vida 42F+13P, sanjh 18F+13P; ANGELA oct-nov 4P/54F; visacion 1-11 nov sin fecha de venta 72, 14 vendidas antes); vendedor 403, sin sesion 401, empresa invalida 400, pendientes+visacion 400; captura QA-S2-01 (bodeguero termina en /bodega)
- Commits: 5cd404c, 7449d37 (S2a), 181ee59 (S2b)
- Gates disparados: ninguno
- QA (Fase E): s2 PASA 6/6, 1.22 USD. Hallazgos: EXP-1 rango invertido con error generico y EXP-3 consultas con fechas a medio teclear (400) -> se corrigen en S3 (mismo archivo); EXP-4 no es defecto
- Desvios del Programador: ninguno (reporto el exceso de lineas sin recortar)
- QA metricas: FP 0, ESC 0, ACIERTOS 2 (EXP-1, EXP-3), costo QA 1.22 USD; mejoras de QA: ninguna nueva

## 2026-11-11 - Slice: S3 filtros persistentes por usuario (R6) + EXP-1/EXP-3 de S2
- Programador: deep (deepseek-flash, effort low): s3-A 1.3 USD aprox; s3-BCD 378 s 4.49 USD
- Contrato: migracion 010 public.vendedores_filtros (PK usuario_id, UPSERT), GET/PUT /api/vendedores/filtros (usuario_id solo de la sesion, claves desconocidas 400, validacion reutiliza parsearFiltros), restauracion con una sola consulta inicial, debounce 500 ms, fechas de venta vacias sin visacion vuelven al mes (decision del Director), rango invertido con mensaje claro y sin consultar con fechas parciales
- Lineas: 314 netas -> commiteado en S3a (migracion+lib+API, ~182) y S3b (cliente, ~129)
- Tests: 131/131 VERDE en los archivos del slice (ROJO previo); jest completo: solo fallas preexistentes; build OK
- Verificacion propia: migracion 010 aplicada en la base de pruebas (Director); filas de vendedores_filtros separadas por usuario tras la Fase E (99.999.991-1 y 99.999.994-4 con filtros distintos)
- Commits: 4a8e5e5 (S3a), 44e372d (S3b)
- Gates disparados: ninguno. Pendiente para el deploy: aplicar migrations/010 en produccion (Senal 3)
- QA (Fase E): s3 PASA 6/6, 1.04 USD. EXP-1 (recargar antes de 500 ms pierde el ultimo cambio) -> se corrige en S4b con fetch keepalive; EXP-3 descartado (consistente)
- Desvios del Programador: el validador del servidor tambien exige anio 2000-2100 (declarado, aceptado)
- QA metricas: FP 0, ESC 0, ACIERTOS 1 (EXP-1), costo QA 1.04 USD

## 2026-11-11 - Slice: S4 modal de detalle de nota (R7) (S4a datos+API, S4b modal) + EXP-1 de S3
- Programador: deep (deepseek-flash, effort low): s4-A; s4a-BCD 296 s 4.70 USD; s4b-BCD 451 s 7.68 USD; s4b-fix ~0.8 USD (sesion acumulada 8.44)
- Contrato: reglasModulo compartido (tabla, detalle y luego comisiones); GET /api/vendedores/notas/[empresa]/[nota] (whitelist, nota numerica, 404 fuera del modulo); imagen por LATERAL LIMIT 1; diferencia sum(totalrea) vs val_rea (correccion del Director: el Programador creia que totalrea no existia, verificado en la base); modal con 7 columnas, total de ganancia y aviso D13/D14; flush de filtros con fetch keepalive en pagehide/desmontaje (EXP-1 de S3)
- Lineas: S4a 194, S4b 198 (dentro del limite)
- Tests: S4a 121/121, S4b 54/54 + fix 37/37 VERDE (ROJO previo)
- Verificacion propia (API real, base de pruebas): sanjh 003816 2 lineas sin diferencia; vida 002499 5 lineas diferencia 181,50; nota inexistente/otra empresa 404; empresa invalida e inyeccion 400; carga inicial sin filtros guardados muestra 01-11 a 11-11 y 86 notas (no se reprodujo la observacion del agente de fechas vacias)
- Commits: 195db64 (S4a) y el de S4b
- Gates disparados: ninguno
- QA (Fase E): s4 PASA 4/4 (valores de % y ganancia por linea fijados por el Director, incluido margen negativo), 0.60 USD. EXP-1 tabla del modal cortada en movil -> ARREGLADO antes del commit; warning next/image -> ARREGLADO; ref DialogClose -> D8
- Desvios del Programador: ninguno
- QA metricas: FP 0, ESC 0, ACIERTOS 1 (EXP-1 movil), costo QA 0.60 USD

## 2026-11-11 - Slice: S5 comisiones (S5a informe GET + migracion 011, S5b PUT del % + panel) (R8, R9)
- Programador: deep (deepseek-flash, effort low): s5-A; s5a-BCD 252 s 4.18 USD; s5b-BCD 313 s 7.08 USD
- Contrato: informe por mes de facturacion (fechadoc), solo facturadas, reglasModulo (futuras fuera), una fila por vendedor valido aunque tenga 0, comision por fila half-up y total = suma de filas; public.vendedores_config (fila unica id=1, 0,50 por defecto); PUT valida 0-100 con 2 decimales y devuelve el informe recalculado; ComisionesPanel debajo de la tabla, la UI no recalcula
- Lineas: S5a 193, S5b 197
- Tests: S5a 132/132, S5b 104/104 VERDE (ROJO previo)
- Verificacion propia: consulta independiente del Director = API = pantalla (2026-11: 72 / 157.103,40 / 785,52; 2026-10: 154 / 406.242,30 / 2.031,21; con 1 %: 1.571,03). Migracion 011 aplicada en pruebas por el Director (identica al archivo)
- Commits: 8671aa2 (S5a) y el de S5b
- Gates disparados: ninguno. Pendiente para el deploy: aplicar migrations/010 y 011 en produccion (Senal 3)
- QA (Fase E): s5 PASA 6/6, 0.67 USD. EXP-A (cambiar mes y % a la vez pierde el %) -> se corrige en S6; EXP-B formato $ de la app -> descartado
- Desvios del Programador: ninguno
- QA metricas: FP 0, ESC 0, ACIERTOS 1 (EXP-A), costo QA 0.67 USD

## 2026-11-11 - Slice: S6 exportar comisiones a .xlsx (R10) + EXP-A de S5
- Programador: deep (deepseek-flash, effort low): s6-A; s6-BCD 349 s 5.20 USD
- Contrato: `?formato=xlsx` en GET /api/vendedores/comisiones (mismas guardas, formato invalido 400), lib/comisiones-xlsx.ts puro con SheetJS (ya en el repo), hoja = mes, filename comisiones-YYYY-MM.xlsx, numeros con formato "$"#,##0.00 y 0.00"%", fila TOTAL literal de la API; ancla Exportar en ComisionesPanel; EXP-A: cambiar de mes no pisa el % que se esta editando
- Lineas: 70
- Tests: 67/67 VERDE (ROJO previo)
- Verificacion propia: el Director abrio los .xlsx descargados por el agente: octubre 2026 = pantalla (154 / 406.242,30 / 2.031,21), celdas numericas con formato $ y %, hoja "octubre 2026"; enero 2020 en 0
- Gates disparados: ninguno
- QA (Fase E): s6 PASA 3/3, 0.58 USD; hallazgos descartados con verificacion
- Desvios del Programador: la fila TOTAL lleva el % (igual que la pantalla): aceptado (R10). Informo una falsa alarma de "TEST_DATABASE_URL = DATABASE_URL": verificado por el Director, en .env son hosts distintos (el script veia el entorno del proceso ya redirigido a pruebas)
- QA metricas: FP 0, ESC 0, ACIERTOS 0, costo QA 0.58 USD

## 2026-11-11 - Senal 3 (modulo VENDEDORES + drawer, commits 2ac571c..HEAD, S1-S6)
- /ponytail-audit: AMARILLO. C1 (humoProd exige VENDEDORES con flags apagados) -> se resuelve encendiendo ambos flags en el commit de deploy, decision de Pablo en la UAT. C2 (/api/kardex/ventas no respetaba su flag) -> ARREGLADO 828eba4 con test. Deuda no critica anotada en logs/senal3-vendedores.md (autorizar() copiado en 4 rutas, tipos duplicados, VendedoresClient grande, bloque de ventas del drawer).
- Build de produccion: compila sin errores (warnings solo del lint preexistente). Variables de entorno: ninguna nueva en el diff.
- Zonas de riesgo con test: middleware (middleware-matcher), TopNav (topnav-saludo-hidratacion, vendedores-menu), lib/fechas (fechas-cl), /api/kardex (kardex-api reescrito), lib/ventas-producto (kardex-ventas).
- Fase E release-vendedores (R1-R10, flags encendidos solo en pruebas): 10/10 PASA en el 2o intento (1o incompleto por turnos); veredicto de auditoria INVALIDO solo por no incluir el barrido. R11 (flags apagados) verificado por el Director en cada slice y cubierto por tests.
- Barrido: 2 intentos, 0 ROTO en lo cubierto (login, dashboard, /vendedores completo, drawer de /precios, menu movil), pero el agente corta y lo declara BLOQUEADO -> no encadena continuaciones (FRIC en MEJORAS-QA). Hueco declarado: barrido total de las pantallas no tocadas no completado.
- Hallazgos del release: D14 (lineas duplicadas, ya en backlog), D11 (37 imagenes 404 de Cloudinary), EXP-2 limpiar fechas (por diseno). QA-REGISTRO sin pendientes abiertos.
- Pendiente (gate humano): UAT de Pablo; decidir encender drawer-ventas-detalle y vendedores-modulo en el deploy; aplicar migrations/010 y 011 en la base de PRODUCCION (crean 2 tablas en public, idempotentes); luego push a main, humo qa-prod -ConIA.
- Costo QA del release: ~3.6 USD (release 2 intentos + barrido 2 intentos).

## 2026-11-11 - Deploy modulo VENDEDORES + drawer (b750775) + humo de produccion
- UAT de Pablo: aprobada (22:11). Decisiones de Pablo: encender drawer-ventas-detalle y vendedores-modulo; autorizo migraciones en produccion; Comisiones abre siempre en el mes en curso (ya era asi: el mes no se guarda, verificado en el codigo y en la Fase E de S5).
- Migraciones 010 y 011 aplicadas en la base de PRODUCCION antes del push (tablas no existian; quedaron creadas; vendedores_config id=1 en 0,50).
- Push 2ac571c..b750775 a main (Vercel).
- Humo qa-prod.ps1 -EsperarDeploy -ConIA: PASA en 7 pasadas (anon; admin, vendedor, bodeguero sin IA y con IA). Costo 3.09 USD.
- Pendientes nuevos del humo: imagenes 404/400 de Cloudinary en /deseados?modo=china -> BACKLOG D11 (preexistente).
- Abierto: D13 + D14 (sync WinFac, manana en el PC de Pravin), D9 EN PAUSA, D6/D7/D8/D10/D11/D12 en backlog, deuda del ponytail (logs/senal3-vendedores.md), mejoras de QA PENDIENTES en MEJORAS-QA.md.

## 2026-11-24 - Slice: S7 (a-d) mejoras de /vendedores y menu movil (modal, tabla, ganancia por periodo, menu movil v2)
- Programador: 4 slices EN PARALELO en worktrees aislados (`_dt-vida-digital\wt-s7a..d`, ramas feat/s7a..d, integracion en feat/vendedores-ui-v2): S7a y S7c deep (deepseek-flash), S7b y S7d codex; S7c partido en S7c-1 (backend) y S7c-2 (UI) por el limite de 200 lineas
- Contrato: S7a modal (imagen 56x56 cuadrada, modal 95vw/sm:max-w-7xl, % total de ganancia de la nota = ganancia / sum(costo x unidades)); S7b tabla (Estado Facturada verde / Pendiente rojo, paginacion cliente 25/50/100); S7c-1/2 ganancia Vida+SANJH por dia/semana/mes/anio (`/api/vendedores/ganancia`, panel "Ganancia por periodo", flag `vendedores-ganancia-periodo`); S7d menu movil superior desplegable desde el logo (flag `menu-movil-v2`, "Cerrar sesion" para todos los roles)
- Lineas de produccion: S7a +11, S7b 74, S7c-1 200, S7c-2 187, S7d ~130
- Tests: jest por archivo (--runInBand) VERDE en cada slice con ROJO previo; tsc = 55 errores preexistentes, identicos a la base (0 nuevos)
- Verificacion propia: diff leido por slice contra el contrato; ganancia de 2026-11 recalculada por el Director con una consulta independiente linea a linea (Vida 23.385,62 / SANJH 23.807,19) = API = pantalla; build de la rama integrada compila
- Commits: ver `git log feat/vendedores-ui-v2` (a741cd8, c88de00, 1530e98, da385ba->7bb461f, 6d697c5->dc4252a + merges). NO esta en main ni desplegado
- Gates disparados: ninguno. Pendiente (gate humano): UAT de Pablo, encender `vendedores-ganancia-periodo` y `menu-movil-v2` en el deploy, Senal 3 (ponytail-audit, humoProd debe exigir "Ganancia por periodo" en /vendedores)
- QA (Fase E): UNA corrida agrupada de UI s7 (15 casos, desktop+movil, flags solo en pruebas): 14 PASA, 1 FALLA (QA-12 tocar fuera del menu movil), reproducida en la re-prueba; hallazgos EXP-1 (buscador de /precios tapaba el menu) y EXP-2 (mensaje de rango invertido) corregidos; EXP-3 y EXP-4 descartados. Segunda corrida acotada s7b (5 casos): PASA 5/5. Costo QA ~3.58 USD
- Desvios del Programador: S7a justifico width/height por un "warning de sizes" que no aplica (ImageWithFallback usa unoptimized): las miniaturas apaisadas no eran cuadradas; corregido volviendo a `fill` (S7a fix). Ningun otro
- QA metricas: FP 0, ESC 0, ACIERTOS 2 (EXP-1, EXP-2) + 1 falla real (QA-12), costo QA 3.58 USD
- Hallazgo ajeno al slice: `.env` esta VERSIONADO en git (tracked, no ignorado) y modificado: contiene secretos; fuera de alcance, se informa a Pablo
## 2026-11-24 - S8/S9 + release vendedores-ui-v2
- S8: ganancia por periodo exacta (redondeo por nota en SQL, centavos enteros) y estado por defecto Facturadas. Verificacion independiente SQL/JS coincide con API.
- S9: enlace Dashboard (solo admin) en menu movil, 45/45 tests, tsc 55 errores preexistentes sin cambio.
- Senal 3: ponytail-audit VERDE, QA regresion 12/13 PASA + R10 verificado por Director, flags vendedores-ganancia-periodo y menu-movil-v2 = true, sin variables de entorno ni migraciones nuevas.
- BACKLOG: EXP-1/2/3 de QA s8, rango personalizado se pierde al cambiar agrupacion, .env versionado (diferido por Pablo).

## 2026-11-24 - Release s10 (backlog D6-D14 + S11 tests)
- Slices s10a-g + s11 integrados en release/s10. Verificacion: jest 130/130 suites (1016 tests), vitest 16/16 (81), tsc 0, build OK sin ignoreBuildErrors.
- QA UI (qa\s10-intento1): 20 PASA + R10 verificado por el Director. EXP-1..4 al backlog.
- Gates abiertos: D9 (repo publico/.env: privatizar y rotar claves), D13/D14 (instalar sync en PC de Pravin, dry-run y --apply).

## 2026-11-24 - Cierre de sesion
- Worktrees eliminados, doc de sync renombrado, CONTEXT-CLAUDE-CHAT.md creado con el estado completo para continuar desde otra cuenta.

## 2026-11-26 - Slice s12 (a-c): filtro de fechas de /vendedores con interruptor Venta / Facturación
- Causa: la nota 002578 (vida, ANGELA; venta 2026-11-20, facturada 2026-11-26) no salía con el rango "hoy a hoy" porque Desde/Hasta filtraba siempre por fecha de venta (`fechanvt`). No era el sync de WinFac: la nota ya estaba en Neon (pestadot 3, visaadua 555737). Los filtros guardados de los usuarios (ej. desde=hasta=2026-11-26) la excluían.
- Decisión de Pablo: UN solo rango de fechas con atajos Hoy / Esta semana / Este mes y un interruptor "Buscar por: Fecha de nota de venta | Fecha de facturación".
- s12a (backend): `modoFecha` ('venta' | 'facturacion') en `lib/filtros-validacion.ts` y `lib/vendedores-notas.ts` (columna `fechanvt` / `fechadoc` por mapa fijo, nunca desde texto del usuario; params [hoy, desde, hasta, vendedor, estado, limit]; orden por la fecha elegida). Facturación fuerza facturadas (+ pendientes = 400 en API). Migración al leer de filtros guardados viejos con visaDesde/visaHasta (sin SQL, nunca 400): visa sin fechas de venta -> modo facturación; visa con fechas de venta -> se descarta. `GET /api/vendedores/filtros` valida/migra. reglasModulo, ganancia y comisiones sin cambios.
- s12b (UI): `VendedoresClient.tsx`: interruptor con `aria-pressed`, un solo par Desde/Hasta, se elimina "Visación desde/hasta", `modoFecha` en las 6 claves guardadas y en la URL solo si es facturación. s12c: en facturación el selector Estado muestra siempre Facturadas con Todas y Pendientes deshabilitadas; un guardado raro se normaliza antes del primer fetch.
- Decisión del Director: SIN feature flag nuevo (el módulo ya va detrás de `vendedores-modulo`; el cambio reemplaza una semántica dentro de él y un flag dejaría el modo facturación visible pero rechazado por la API). Excepción documentada a la regla de Fase D.
- Programador: claude-deep (deepseek-flash). Fase A 3.26 + s12a 10.69 + s12b 3.73 + s12c 2.55 = 20.23 USD. Contrato aprobado por el Director; Fase A de solo lectura.
- Verificación propia del Director: diff leído contra el contrato en cada slice; jest vendedores 16 suites / 383 tests verdes; `verificar.ps1` s12 y s12c: tsc 0, tests 0 fallas, build OK; lint=1 es preexistente (errores en ~190 archivos ajenos, ninguno en archivos de s12).
- Caso real reproducido por el Director con las reglas del módulo sobre producción (solo lectura): nota 002578 aparece con Facturación + 2026-11-26, NO aparece con Venta + 2026-11-26 y SÍ aparece con Venta + 2026-11-20.
- QA (Fase E): s12 6/6 PASA (1.10 USD; incluye caso real con la nota 002518 venta 10-11 / facturada 11-11, recarga con F5, atajos, móvil 390x844); s12c 3/3 PASA (0.44 USD). EXP-1..3 sin hallazgo (DESCARTADO); EXP-4 tablas anchas cortadas en móvil -> BACKLOG (preexistente).
- Datos: 112 notas facturadas de oct-nov tienen `fechadoc > fechanvt`; las pendientes casi no tienen `fechadoc` (25 de 27): por eso en modo facturación solo hay facturadas.
- Commit en rama feat/vendedores-filtro-fecha-modo. NO está en main ni desplegado. Gate humano pendiente: UAT de Pablo y Señal 3 (ponytail-audit, humoProd) antes del merge/deploy. `.env` sigue versionado en git y modificado (D9, diferido por Pablo): NO incluido en el commit.
- Release s12 a main (0edfbff) el 2026-11-26 14:29 por decision de Pablo (UAT en produccion), SIN ponytail-audit previo: Senal 3 parcial (build, tests, QA de regresion ok; auditoria pendiente). Humo qa-prod (solo lectura, sin IA): PASA 28 casos, 0 errores de consola, pero solo con la sesion del rol vendedor; /vendedores (admin) no quedo cubierto por el humo.


## 2026-11-26 - s12d + s12e: interruptor (switch) compacto para Buscar por fecha de venta / facturacion
- Pedido de Pablo: el modo de fecha debia ser un switch toggle, no dos botones grandes (s12b los habia dejado como control segmentado). Cambio: s12d reemplaza los botones por un switch real (role=switch, aria-checked); s12e lo retoca: texto de ayuda en su propia linea fuera del bloque (la fila de filtros no se mueve al encender), switch h-6 w-11 con area tactil de 44px y contraste en modo oscuro.
- Programador deep: s12d 2.78 USD, s12e 2.20 USD. Verificacion propia: diff contra contrato; jest vendedores 16 suites / 390 tests verdes, tsc 0, build OK; lint=1 preexistente.
- QA: s12d 3/3 PASA (0.49 USD); s12e 2 obligatorios PASA + 1 BLOQUEADO (modo oscuro no emulable por el agente: limitacion, sin revisar) (0.42 USD). Observacion: al apagar el switch Estado queda en Facturadas (comportamiento de diseno).
- Backlog: F1 buscador por nota y cliente en /vendedores (BACKLOG-DEBUGGING.md).
- Commit en rama feat/vendedores-toggle-switch. NO esta en main. Pendiente: decision de Pablo sobre produccion.


## 2026-11-26 - s13g: Ganancia por periodo con atajos de rango
- Pedido de Pablo: el filtro de fechas de Ganancia por periodo 'no funciona'. Causa (evidencia): los botones Dia/Semana/Mes/Año agrupan las filas del mismo rango (requisito S8: el Total no cambia al agrupar), no fijan el rango; el panel no tenia atajos de rango, por eso el Total era siempre el mismo.
- Cambio: atajos Hoy / Esta semana / Este mes (fijan Desde/Hasta con una sola consulta, fechas calculadas en el click), etiqueta visible 'Agrupar por:' y nota 'El rango usa la fecha de la nota de venta.'. Sin cambios de API ni de consulta.
- Programador deep: 3.62 USD. Verificacion propia: diff contra contrato; jest vendedores 16 suites / 398 tests verdes, tsc 0, build OK; lint=1 preexistente.
- QA s13g: 3/3 PASA (0.43 USD; Total Este mes igual en Dia/Semana/Mes/Año; movil sin cortes). Limitacion: Hoy y Esta semana dieron 0 por falta de ventas en esos dias en la base de pruebas.
- Commit en rama feat/vendedores-toggle-switch. NO esta en main.


## 2026-11-26 - s14: el rol vendedor accede a /vendedores (sin Ganancia, sin detalle de nota, % de comision solo lectura)
- Pedido de Pablo: el vendedor debe entrar a /vendedores y ver solo la tabla de notas y Comisiones; no Ganancia por periodo. Decisiones con Pablo: ve tabla y comisiones como el admin (todos los vendedores); no abre el detalle de nota (costos); bloqueo tambien en el servidor.
- Decision del Director C1 (a avisar): el PUT /api/vendedores/comisiones cambia el % GLOBAL; queda solo admin y el vendedor ve el % como texto.
- Slices: s14a servidor (8b1dba2: roles.ts con puedeVerVendedores / puedeVerGananciaVendedores / puedeEditarComisionPct, middleware, 3 rutas API), s14b pantalla y menu (7f9a573), s14d docs/config QA (PRD R3 y R12-R15, qa-entorno.json, qa-barrido.md). Sin feature flag nuevo.
- Costos programador deep: s14-A 3.09, s14a 4.19, s14b 4.89, s14d 3.00 USD. Verificacion propia: diffs contra contrato, jest suite completa 1094 verdes, tsc 0, build OK (lint=1 preexistente).
- QA s14 (1.47 USD): 5 de 6 casos PASAN (vendedor sin Ganancia ni detalle, 403 en APIs bloqueadas, % solo texto, regresion admin, bodeguero redirigido). QA-S14-06 FALLA solo por expectativa demasiado amplia del caso: el vendedor ya veia Sincronizar WinFac / Categorias antes de s14 (preexistente, BACKLOG D15, decision de Pablo). Filtros y F5 del vendedor OK.
- C2: el humo de produccion no distingue roles en la misma ruta; se espera una falsa FALLA del vendedor en /vendedores hasta resolverlo.
- Release: Pablo autorizo explicitamente mandar todo a produccion cuando estuviera OK (2026-11-26 16:12). /ponytail-audit (Senal 3) NO se corrio.


## 2026-11-26 - s15: buscador en /vendedores (F1)
- Pedido de Pablo: un solo buscador por N de nota de venta o nombre de cliente, resultados en vivo mientras se tipea, clic abre el registro.
- Slices: s15a API GET /api/vendedores/buscar (9f9b3ee), s15b UI BuscadorNotas (b5d76d5). Flag vendedores-buscador, encendido en este release.
- Admin: el clic abre el detalle de la empresa correcta (con costos). Vendedor: cuadro solo cabecera, sin costos ni ganancia. Busqueda efimera: no toca filtros ni tabla.
- Limitacion conocida: la API une siempre Vida Digital + SANJH, no respeta el selector de Empresa (decision para un slice posterior).
- Verificacion propia: jest completo 132 suites / 1135 tests verdes, tsc 0, build OK (lint=1 preexistente en archivos ajenos).
- QA s15 (1.51 USD): 7 de 7 PASA, sin defectos ni errores de consola.
- D15 aceptado por Pablo (vendedor puede entrar a /admin/importar).
- Release: autorizado por Pablo (2026-11-26 16:41). /ponytail-audit (Senal 3) NO se corrio.