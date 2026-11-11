CREATE TABLE IF NOT EXISTS public.vendedores_filtros (
  usuario_id INTEGER PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  filtros    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
