-- s18: heredar foto al insertar filas nuevas del mismo codigo normalizado.
-- No modifica los esquemas de WinFac (solo lectura).

CREATE INDEX IF NOT EXISTS idx_productos_codigo_norm
  ON public.productos (upper(btrim(codigo)))
  WHERE imagen_url IS NOT NULL AND public_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.productos_heredar_imagen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE origen public.productos%ROWTYPE;
BEGIN
  IF NEW.imagen_url IS NOT NULL OR NEW.public_id IS NOT NULL THEN
    RETURN NEW;                        -- la fila ya trae algo: no mezclar
  END IF;

  SELECT * INTO origen FROM public.productos p
   WHERE upper(btrim(p.codigo)) = upper(btrim(NEW.codigo))
     AND p.imagen_url IS NOT NULL
     AND p.public_id IS NOT NULL       -- solo vinculo Cloudinary verificado
   ORDER BY p.updated_at DESC NULLS LAST, p.id DESC
   LIMIT 1;

  IF FOUND THEN
    NEW.imagen_url := origen.imagen_url;
    NEW.public_id  := origen.public_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_productos_heredar_imagen ON public.productos;
CREATE TRIGGER trg_productos_heredar_imagen
BEFORE INSERT ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.productos_heredar_imagen();

-- Down:
-- DROP TRIGGER IF EXISTS trg_productos_heredar_imagen ON public.productos;
-- DROP FUNCTION IF EXISTS public.productos_heredar_imagen();
-- DROP INDEX IF EXISTS public.idx_productos_codigo_norm;
