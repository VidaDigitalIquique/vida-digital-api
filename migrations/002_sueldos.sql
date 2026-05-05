CREATE TABLE IF NOT EXISTS public.sueldos (
  id                SERIAL PRIMARY KEY,
  trabajador_nombre TEXT NOT NULL,
  mes               INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio              INTEGER NOT NULL,
  monto_base        NUMERIC(12,2) NOT NULL,
  monto_final       NUMERIC(12,2) NOT NULL,
  pagado_at         TIMESTAMPTZ,
  creado_por        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
