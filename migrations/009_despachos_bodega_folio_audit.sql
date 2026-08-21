CREATE TABLE IF NOT EXISTS public.despachos_bodega_folio_audit (
  id              SERIAL PRIMARY KEY,
  despacho_id     INTEGER NOT NULL REFERENCES public.despachos_bodega(id),
  folio_anterior  TEXT NOT NULL,
  folio_nuevo     TEXT NOT NULL,
  corregido_por   TEXT NOT NULL,
  corregido_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
