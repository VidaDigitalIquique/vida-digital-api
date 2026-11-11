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