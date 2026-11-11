# CLAUDE.md — vida-digital-api (App Vida Digital)

Metodo pBravoT. Programador: escribe codigo solo en ciclos pBravoT (ver ~/.claude/CLAUDE.md). Nunca commit ni push.

## Stack
- Next.js 14.2 (App Router, `app/(app)/...`), React 18, TypeScript, Tailwind + shadcn/ui.
- Auth: next-auth v4, CredentialsProvider con **RUT + contrasena** contra la tabla `usuarios` (bcryptjs).
  Sesion: `(session.user as any).rol` (sin "e"), `.nombre`, `.rut`, `.empresas` (tabla `usuario_empresa`).
- Roles y rutas: `middleware.ts` -> `RUTAS_POR_ROL` (admin, vendedor, bodeguero). Una pantalla nueva se agrega ahi.
- Base: PostgreSQL en Neon, `lib/db.ts` (`sql` de @neondatabase/serverless). Esquemas `vida` y `sanjh` = replica de
  WinFac (los usan otras apps, ej. App Arjun, en solo lectura): no modificar su estructura.
- Produccion: https://vidadigital-inventario-v2.vercel.app (Vercel despliega desde `main`).

## Comandos
- dev: `npm run dev` · build: `npm run build` · lint: `npm run lint` · tipos: `npx tsc --noEmit`
- tests: `npm test` (jest). Hay tambien `vitest.config.ts`: usar el runner que ya usen los tests del modulo.
- Los tests NUNCA deben tocar la base de produccion: usar mocks o `TEST_DATABASE_URL`.

## Documentos
- PRD de cada modulo nuevo: `PRD.md` (seccion "Flujos criticos y criterios de aceptacion" con bloques
  `### R<n> — <flujo> (riesgo: x)` + Rol/Dado/Cuando/Entonces: son la base de QA). Historico: `PRD_Caja_Mayor.md`.
- Bugs: `BUGS.md`. Registro de slices: `AUTO-LOG.md`. QA: `QA-REGISTRO.md` (lo escribe el tooling).

## Debugging
Protocolo: ~/.claude/PBRAVOT-DEBUGGING.md. Se activa con "hay un bug", "se rompio", "dejo de funcionar",
"sigue pasando". Registro en `BUGS.md`.

## Modo PowerShell
Protocolo: ~/.claude/PBRAVOT-MODO-POWERSHELL.md. Registro en `AUTO-LOG.md`.
**Este repo esta directo en Documents: usar SIEMPRE `-DtDir C:\Users\pablo\Documents\_dt-vida-digital`**
en deep.ps1, verificar.ps1, qa-ciclo.ps1 y qa-prod.ps1 (si no, los logs se mezclan con otros proyectos).

## Entorno QA (Fase E)
- Comando unico: `qa-ciclo.ps1 -Repo <este repo> -DtDir C:\Users\pablo\Documents\_dt-vida-digital -Name s<N> -Casos <casos.md> -Detach`
- URL de pruebas: http://localhost:3124 (`npm run dev -- -p 3124`). Config: `.pbravot/qa-entorno.json`.
- Base de pruebas: rama Neon aparte, en `.env` como `TEST_DATABASE_URL` (las guardas no arrancan sin ella ni si
  apunta a produccion).
- Cuentas sinteticas por rol: `qa-admin`, `qa-vendedor`, `qa-bodeguero` (las crea `.pbravot/qa-preparar.mjs` en la
  base de pruebas con contrasena nueva en cada corrida; quedan en `_dt-vida-digital\qa\cuentas.json`).
- Reglas de datos: `.pbravot/qa-datos.md`. Barrido de toda la UI: `.pbravot/qa-barrido.md` (cuando exista).
- Humo en produccion despues de cada deploy: `qa-prod.ps1 -Repo <este repo> -DtDir C:\Users\pablo\Documents\_dt-vida-digital -EsperarDeploy -Detach`
  (bloque `humoProd` de qa-entorno.json; una pantalla nueva debe agregarse ahi o el humo da INCOMPLETO).