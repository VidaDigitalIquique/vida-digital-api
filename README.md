# App Vida Digital

Aplicación web de gestión de Importadora Vida Digital: inventario, ventas, despachos,
clientes, catálogos y comisiones de vendedores. Trabaja sobre los datos de WinFac
(esquemas `vida` y `sanjh`, en solo lectura) y PostgreSQL en Neon.

## Stack

- Next.js 14.2 (App Router) + React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- PostgreSQL en Neon, consultado con `@neondatabase/serverless` (`lib/db.ts`)
- Autenticación: next-auth v4 con CredentialsProvider (RUT + contraseña, bcryptjs)
- Tests: Jest + Testing Library y Vitest

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run start      # servir el build
npm run lint       # ESLint (next lint)
npm test           # Jest + Vitest
npx tsc --noEmit   # chequeo de tipos
```

## Estructura

- `app/` — rutas de la App Router: páginas privadas en `app/(app)/` (dashboard, inventario,
  ventas, precios, bodega, despachos, vendedores, caja mayor, etc.), login en `app/(auth)/`
  y endpoints en `app/api/`.
- `components/` — componentes de UI (incluye `components/ui/` de shadcn/ui).
- `lib/` — lógica de negocio y acceso a datos (db, auth, comisiones, sync con WinFac, etc.).
- `middleware.ts` — control de acceso por rol (`admin`, `vendedor`, `bodeguero`).
- `config/feature-flags.json` — feature flags.
- `migrations/` — migraciones SQL.
- `scripts/` — utilidades de línea de comandos (seed, migraciones, reconciliación).
- `tests/` y `__tests__/` — tests de Vitest y Jest.
- `types/`, `hooks/`, `utils/`, `contexts/` — tipos, hooks, utilidades y contextos compartidos.

## Entorno

Las variables de entorno se declaran en `.env.example` (nombres únicamente; los valores
reales no se versionan).

## Documentación

- [CLAUDE.md](CLAUDE.md) — contexto técnico y método de trabajo del proyecto.
- [PRD.md](PRD.md) — requerimientos y flujos críticos.
- [BUGS.md](BUGS.md) — registro de bugs.
