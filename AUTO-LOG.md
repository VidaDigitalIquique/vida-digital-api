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
