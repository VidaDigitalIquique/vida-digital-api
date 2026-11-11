CREATE TABLE IF NOT EXISTS public.vendedores_config (
  id           SMALLINT PRIMARY KEY CHECK (id = 1),
  comision_pct NUMERIC(5,2) NOT NULL DEFAULT 0.50
               CHECK (comision_pct >= 0 AND comision_pct <= 100),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL
);
INSERT INTO public.vendedores_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
