CREATE TABLE IF NOT EXISTS public.pettycash_movimientos (
  id          SERIAL PRIMARY KEY,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  concepto    TEXT NOT NULL,
  monto       NUMERIC(12,2) NOT NULL,
  empresa_id  INTEGER,
  creado_por  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
