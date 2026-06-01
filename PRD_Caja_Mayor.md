---

**PRD DEFINITIVO — Sprint: Módulo Caja Mayor**
**App Vida Digital | PBT-IA**

---

## 1. Objetivo

Reemplazar el Excel "Caja Mayor (Bank).xlsm" con un módulo web integrado a la app Vida Digital. Es una caja completa: registra cobros de clientes y salidas de dinero, organizado por cuenta bancaria, con trazabilidad por nota de venta y conversión de moneda centralizada.

---

## 2. Contexto técnico verificado

- Stack: Next.js 15 App Router, PostgreSQL/Neon, NextAuth, Tailwind + shadcn/ui
- Session: `rol` (sin 'e'), `(session.user as any).rol`, nombre de usuario en `nombre`
- Cliente comprador: campo `kcodcli2` en `vida.movidcto` y `sanjh.movidcto`
- **Fuente de notas de venta verificada:**
  - Tabla: `vida.movidcto` / `sanjh.movidcto`
  - Filtro ventas: `tipomovi = 'V'` y `kcodcli2 IS NOT NULL`
  - Número de nota: `knumfoli`
  - Total real a cobrar: `val_rea` (no `val_doc` — `val_rea` es el valor real de la venta)
  - Nombre cliente: `cliente`
  - Fecha nota: `fechanvt`
- No hay framework de migraciones — DDL directo en Neon
- PowerShell local: nunca `&&`, usar `;` o bloques separados

---

## 3. Roles y permisos

- **Admin y Vendedor**: crear, editar, eliminar movimientos de caja
- **Solo Admin**: acceder a `/admin/caja-config` (dólar del día + cuentas bancarias)
- **Todos**: ver el módulo y consultar el valor del dólar vigente

---

## 4. DDL — Tablas nuevas en Neon

```sql
-- Configuración global (dólar del día)
CREATE TABLE caja_config (
  id          SERIAL PRIMARY KEY,
  clave       TEXT NOT NULL UNIQUE,
  valor       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_por TEXT NOT NULL
);
INSERT INTO caja_config (clave, valor, updated_por)
VALUES ('dolar_dia', '0', 'system');

-- Cuentas bancarias configurables
CREATE TABLE caja_cuentas (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  moneda     TEXT NOT NULL CHECK (moneda IN ('USD', 'CLP')),
  activa     BOOLEAN NOT NULL DEFAULT true,
  orden      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO caja_cuentas (nombre, moneda, orden) VALUES
  ('Santander',      'USD', 1),
  ('Santander',      'CLP', 2),
  ('Scotiabank SJ',  'USD', 3),
  ('Scotiabank SJ',  'CLP', 4),
  ('Scotiabank VD',  'USD', 5),
  ('Scotiabank VD',  'CLP', 6);

-- Movimientos de caja
CREATE TABLE caja_movimientos (
  id             SERIAL PRIMARY KEY,
  fecha          DATE NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('cobro', 'gasto')),
  kcodcli2       BIGINT,
  nombre_cliente TEXT,
  cuenta_id      INTEGER NOT NULL REFERENCES caja_cuentas(id),
  moneda         TEXT NOT NULL CHECK (moneda IN ('USD', 'CLP')),
  monto          NUMERIC(14,2) NOT NULL,
  monto_usd      NUMERIC(14,2),
  tipo_cambio    NUMERIC(10,2),
  forma_pago     TEXT NOT NULL CHECK (forma_pago IN ('efectivo', 'cheque', 'transferencia')),
  observaciones  TEXT,
  empresa        TEXT NOT NULL CHECK (empresa IN ('vida', 'sanjh')),
  usuario_id     INTEGER NOT NULL,
  usuario_nombre TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Imputación de pagos a notas de venta
CREATE TABLE caja_movimiento_notas (
  id             SERIAL PRIMARY KEY,
  movimiento_id  INTEGER NOT NULL REFERENCES caja_movimientos(id) ON DELETE CASCADE,
  empresa        TEXT NOT NULL CHECK (empresa IN ('vida', 'sanjh')),
  knumfoli       TEXT NOT NULL,
  monto_aplicado NUMERIC(14,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. Backlog — 6 slices en orden estricto de ejecución

---

### Slice 1 — Configuración: dólar del día + cuentas bancarias

**Ruta:** `/admin/caja-config` (solo rol `admin`)

**Funcionalidad:**
- Input numérico para el valor del dólar del día → escribe en `caja_config` con `updated_por` y `updated_at`
- CRUD completo de cuentas bancarias: nombre, moneda (USD/CLP), orden, activa/inactiva
- El valor del dólar vigente debe ser visible en un banner o header persistente dentro del módulo de caja para todos los usuarios

**Contrato de API:**
- `GET /api/caja/config` → devuelve `{ dolar_dia, updated_at, updated_por }`
- `POST /api/caja/config` → actualiza `dolar_dia`
- `GET /api/caja/cuentas` → lista cuentas activas
- `POST /api/caja/cuentas` → crea cuenta
- `PATCH /api/caja/cuentas/[id]` → edita cuenta
- `DELETE /api/caja/cuentas/[id]` → desactiva cuenta (soft delete: `activa = false`)

---

### Slice 2 — Formulario de registro de movimiento

**Ruta:** `/caja-mayor`

**Campos del formulario:**
- Tipo: dropdown `cobro` / `gasto`
- Fecha: date picker (default hoy)
- Cliente comprador: búsqueda por nombre con autocomplete desde `vida.movidcto` y `sanjh.movidcto` usando `kcodcli2` + `cliente`. Obligatorio si tipo = `cobro`, opcional si tipo = `gasto`
- Empresa: dropdown `vida` / `sanjh` (aparece solo si hay cliente seleccionado con notas en ambas empresas; si solo tiene notas en una, se autoselecciona)
- Monto: input numérico
- Moneda: dropdown `USD` / `CLP`
- Si moneda = `CLP`: mostrar tipo de cambio del día (de `caja_config`) y calcular `monto_usd` en tiempo real con la fórmula del Excel: `ROUNDUP(monto_clp / dolar_dia, 0.5)`
- Cuenta bancaria: dropdown de cuentas activas desde `caja_cuentas`, filtrado por moneda seleccionada
- Forma de pago: dropdown `efectivo` / `cheque` / `transferencia`
- Observaciones: texto libre, opcional
- Botón REGISTRAR → inserta en `caja_movimientos`

**Contrato de API:**
- `GET /api/caja/clientes?q=texto` → búsqueda de clientes compradores en `vida.movidcto` y `sanjh.movidcto`
- `POST /api/caja/movimientos` → crea movimiento

---

### Slice 3 — Imputación a notas de venta

**Se activa:** después de registrar un cobro con cliente seleccionado, o al editar un cobro existente.

**Lógica:**
- Cargar todas las notas de venta del cliente (`kcodcli2`) desde `vida.movidcto` o `sanjh.movidcto` donde `tipomovi = 'V'`
- Para cada nota calcular saldo pendiente: `val_rea - COALESCE(SUM(caja_movimiento_notas.monto_aplicado), 0)`
- Mostrar primero las notas con saldo > 0, ordenadas por `knumfoli` ascendente (más antigua primero)
- Por cada nota mostrar: número (`knumfoli`), fecha (`fechanvt`), total real (`val_rea`), pagado, saldo pendiente
- El usuario puede ingresar `monto_aplicado` por nota — puede ser parcial o total
- La imputación es opcional; se puede registrar un cobro sin imputar
- Al confirmar → inserta en `caja_movimiento_notas`

**Contrato de API:**
- `GET /api/caja/notas/[kcodcli2]?empresa=vida` → notas con saldo calculado
- `POST /api/caja/movimientos/[id]/notas` → registra imputaciones

---

### Slice 4 — Tabla de notas del cliente seleccionado

**Ubicación:** debajo del formulario, al seleccionar un cliente.

**Contenido por fila:** `knumfoli`, `fechanvt`, `val_rea` (total USD), total pagado USD, saldo pendiente USD.

**Reglas visuales:**
- Saldo = 0 → fila verde (pagada)
- Saldo > 0 → fila roja (pendiente)

**Filtros:** Todas / Solo pagadas / Solo pendientes

**Nota sobre moneda:** si el pago fue en CLP, mostrar el equivalente en USD usando el `tipo_cambio` guardado en ese movimiento, no el dólar del día actual.

**Contrato de API:**
- `GET /api/caja/resumen/[kcodcli2]?empresa=vida` → notas con totales calculados y estado

---

### Slice 5 — Edición y eliminación de movimientos

**UI:** ícono lápiz en cada movimiento de la tabla → abre modal.

**Modal:** todos los campos editables (tipo, fecha, cliente, empresa, cuenta, moneda, monto, forma de pago, observaciones, notas imputadas).

**Eliminar:** botón dentro del modal con confirmación explícita → borra en cascada `caja_movimiento_notas` → borra `caja_movimientos`.

**Auditoría:** cada edición actualiza `updated_at` y `usuario_nombre`.

**Contrato de API:**
- `PATCH /api/caja/movimientos/[id]` → edita movimiento
- `DELETE /api/caja/movimientos/[id]` → elimina con cascada

---

### Slice 6 — Vista general de caja

**Ruta:** `/caja-mayor` sin cliente seleccionado (vista por defecto al abrir el módulo).

**Contenido:**
- Banner con dólar del día vigente (siempre visible)
- Resumen de saldos por cuenta bancaria: suma cobros, suma gastos, saldo neto — separado por moneda
- Tabla paginada (50 por página) de todos los movimientos, ordenada por fecha desc
- Filtros: rango de fechas, moneda, cuenta bancaria, tipo (cobro/gasto), empresa

**Contrato de API:**
- `GET /api/caja/movimientos?page=1&cuenta=1&moneda=USD&tipo=cobro&desde=2025-01-01&hasta=2025-12-31` → lista paginada
- `GET /api/caja/resumen-cuentas` → saldos por cuenta

---

## 6. Navegación

- Entrada "Caja Mayor" en el menú lateral
- Ruta principal: `/caja-mayor`
- Ruta de configuración: `/admin/caja-config` (solo admin)

---

## 7. Fuera de scope en este sprint

- Importación del histórico del Excel
- Reportes exportables PDF/Excel
- Alertas de saldos vencidos
- Conciliación bancaria automática

---

