ALTER TABLE public.sueldos
  ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);
