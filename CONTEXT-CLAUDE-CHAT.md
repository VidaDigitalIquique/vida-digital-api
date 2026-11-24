# CONTEXT-CLAUDE-CHAT.md — vida-digital-api (App Vida Digital)

Actualizado: 2026-11-24 ~19:00 (America/Santiago). Para continuar desde otra cuenta/chat de Claude.
Método: pBravoT (Director = Claude chat, Programador = Claude Code/DeepSeek/Codex en PowerShell). Idioma: español.
Preferencias de Pablo: evidencia verificable, leer los archivos reales antes de opinar, nunca asumir, sin widget ask_user_input, NUNCA leer/imprimir/commitear `.env`.

## 1. Dónde está todo
- Repo: `C:\Users\pablo\Documents\vida-digital-api` (rama `main`, GitHub `VidaDigitalIquique/vida-digital-api`, Vercel despliega desde `main`).
- Producción: https://vidadigital-inventario-v2.vercel.app (la URL NO cambió nunca).
- Logs/prompts/QA fuera del repo: `C:\Users\pablo\Documents\_dt-vida-digital\` (`prompts\`, `logs\`, `qa\`, `vt.ps1`, `jest-int.ps1`). Úsalo SIEMPRE como `-DtDir` en deep/verificar/qa-ciclo/qa-prod.
- Scripts pBravoT: `~/.claude/pbravot/` (deep.ps1, codex.ps1, verificar.ps1, qa-ciclo.ps1, qa-prod.ps1, qa-prod-sesion.ps1, paralelo.ps1). Protocolos en `~/.claude/PBRAVOT-*.md`.
- Documentos del repo: CLAUDE.md, PRD.md, BUGS.md, AUTO-LOG.md, QA-REGISTRO.md (lo escribe el tooling; el hook pre-commit bloquea con pendientes alta/crítica abiertos), BACKLOG-DEBUGGING.md, `docs/como_instalar_sync_en_pc_de_pravin.md`.

## 2. Estado actual (HECHO)
- `main` = `c5a35d5`, desplegado. Incluye release/s10: backlog D6–D14 en código, S11 (suites de test), build estricto.
- Verificación del release: jest 130/130 suites (1016 tests), vitest 16/16 (81), `tsc` 0 errores, `npm run build` OK **sin** `typescript.ignoreBuildErrors`.
- QA de UI (qa\s10-intento1): 20 PASA + R10 verificado a mano (xlsx = pantalla: 72 notas, comisión total 1.571,03 al 1 %).
- Humo de producción (commit 7cb4012): PASA en anon, admin, admin-ia, vendedor, bodeguero (`qa-prod.ps1 -EsperarDeploy`).
- Backlog: D1–D8, D10, D11, D12 RESUELTOS. D13/D14: código listo, falta ejecutar (ver §3).
- Flags activos relevantes: `vendedores-modulo`, `vendedores-ganancia-periodo`, `menu-movil-v2`, `fix-d11-imagen-producto`, `seguimientos`, `drawer-ventas-detalle`.
- Worktrees: todos eliminados (solo queda el repo principal). Ramas `feat/*` y `release/s10` siguen locales, ya integradas en main.
- Tests: `npm test` = jest + vitest; specs vitest se llaman `*.vitest.ts`; integración con BD de pruebas en `tests/integration/` (`npm run test:integration`, requiere `TEST_DATABASE_URL`). Los tests nunca deben tocar producción (guarda D6 en jest.setup.js/vitest.config.ts).

## 3. PENDIENTE (gates humanos — requieren a Pablo)
1. **D9 (CRÍTICA, seguridad):** repo público con `.env` versionado. Hacer el repo privado, rotar claves (Neon, Cloudinary, NextAuth, etc.) y luego sacar `.env` del control de versiones. En el árbol de trabajo `.env` aparece modificado: no commitearlo.
2. **D13/D14 (datos):** el sync del PC de Pravin (Zofri) solo hace UPSERT y nunca borra → líneas sobrantes en `itemdcto`/`movidcto` (D13) y duplicados por `kdocitem` con espacios (D14: vida 2.183 filas/572 notas 2025; sanjh 16.766 filas/3.116 notas, 46 en 2026; cifras del 2026-11-11, rehacer con dry-run). Pasos (detalle en `docs/como_instalar_sync_en_pc_de_pravin.md`):
   pausar polling → copiar `sync_winfac_neon.py`, `reconciliacion.py`, `env.example` (variables `SYNC_DELETE_ENABLED=false`, `SYNC_DELETE_MAX_ROWS=100`) y `scripts/limpiar_winfac_historico.py` conservando el `.env` local → dry-run por empresa/tabla contra producción (`--database-env DATABASE_URL`, solo lectura) → revisar conteos → con autorización de Pablo `--apply --max-delete-rows <revisado>` (una empresa/tabla a la vez; respaldar PKs a borrar; segunda corrida debe dar candidatos=0, borrados=0) → recién entonces `SYNC_DELETE_ENABLED=true`. Casos de verificación: Vida 002499 (solo HS-30 y HS-30C, total 2.550), SANJH 000812 (una línea de 1030A).
3. Humo de producción del vendedor: ya pasó en la última corrida; si vuelve a dar BLOQUEADO por sesión, Pablo debe correr `qa-prod-sesion.ps1 -Rol vendedor`.
4. Pablo debe probar él mismo en producción la nota SANJH 003816 (en QA local daba "Nota no encontrada"; el agente usó la 000013 como alternativo y pasó).

## 4. Deuda / backlog no crítico
- EXP-1 (producto 1025: 8 ventas = 4 pares duplicados → es D14), EXP-2 (500 en `/api/deseados/alertas`, sin efecto visible; investigar), EXP-3 (aviso de hidratación `style` en SeguimientosClient), EXP-4 (notas Pendientes con fecha de facturación; posible dato). Detalle en `QA-REGISTRO.md`.
- ~743 errores de eslint (mayoría `no-explicit-any`); `eslint.ignoreDuringBuilds: true` sigue activo en next.config.mjs.
- 404 de imágenes Cloudinary para productos sin imagen (ruido de consola conocido; el placeholder ya cubre la UI).
- Stashes viejos en main: `stash@{0}` (precio individual catálogos) y `stash@{1}` (DEBUG-FREEZE settings.local.json): revisar con Pablo antes de borrar.
- Archivos sin versionar en main (no commitear sin preguntar): `scripts/clientes-sin-match.*`, `vida-digital-arch.drawio/.webp`.
- `.pbravot/qa-entorno.json` → `humoProd`: agregar pantallas nuevas si se crean (si no, el humo da INCOMPLETO).

## 5. Lecciones operativas (aprendidas, no repetir)
- **No correr `npm run build` en una carpeta donde esté corriendo `next dev`** (comparten `.next`; el build dejó al servidor de QA dando 500).
- Llamadas PowerShell con `Start-Sleep` > ~29 s hacen timeout: usar ≤29 s y sondear.
- Codex: no lanzar varios a la vez (choque al instalar skills). `qa-ciclo.ps1` funciona lanzado con `Start-Process pwsh` sin `-Detach`/`-ConQAUI`. El agente de QA necesita sesión válida de Claude Code (`/login`).
- Rutas con corchetes rompen `Select-String -Path`/`Get-Content`: usar `-LiteralPath` o `git grep`.
- Next 14: un `route.ts` no puede exportar nombres que no sean handlers ni tener parámetros opcionales; `page.tsx` no puede exportar helpers (por eso existen `parse-keywords.ts` y `catalog-data.ts`).
- Si hay `node_modules` como junction en un worktree: quitar el enlace con `cmd /c rmdir` ANTES de borrar el worktree (si no, se borra el `node_modules` real).
- Deploy: tras `git push origin main`, `qa-prod.ps1 -EsperarDeploy` (puede dar un FALLA transitorio por SSL durante el swap de Vercel: reintentar antes de alarmar). FALLA/BLOQUEADO persistente → notificación push a Pablo.
- Commits: terminar con las líneas `Co-Authored-By` y `Claude-Session` que indique el sistema.

## 6. Cómo retomar (sugerido)
1. Leer este archivo, `CLAUDE.md`, `BACKLOG-DEBUGGING.md` (D9, D13, D14) y `docs/como_instalar_sync_en_pc_de_pravin.md`.
2. Preguntar a Pablo qué quiere priorizar: (a) ejecutar el plan D13/D14 con él en el PC de Pravin, (b) D9 seguridad, (c) nuevos módulos del PRD, (d) deuda de eslint/EXP.
3. Cualquier slice nuevo: ciclo pBravoT (Fase A contrato → B tests rojos → C → D → verificar.ps1 + revisión propia → commit → Fase E si procede → deploy → `qa-prod.ps1`).