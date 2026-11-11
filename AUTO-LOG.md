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