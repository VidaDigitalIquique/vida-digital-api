CREATE TABLE public.trabajador_config (
  usuario_id integer PRIMARY KEY REFERENCES public.usuarios(id),
  monto_base numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
