CREATE TABLE IF NOT EXISTS public.deudas_solicitudes (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES usuarios(id),
  user_nombre      TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('prestamo','adelanto','quincena')),
  monto            NUMERIC(12,2) NOT NULL,
  descripcion      TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','aceptada','rechazada','confirmada','caduca')),
  solicitado_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceptado_at      TIMESTAMPTZ,
  confirmado_at    TIMESTAMPTZ,
  caduca_at        TIMESTAMPTZ NOT NULL,
  rechazado_motivo TEXT,
  creado_por       TEXT NOT NULL
);
