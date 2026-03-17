DO $$
BEGIN
  -- app_physical_count: asegurar columnas estándar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='productCode'
  ) THEN
    ALTER TABLE public.app_physical_count ADD COLUMN "productCode" TEXT;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='productcode'
    ) THEN
      EXECUTE 'UPDATE public.app_physical_count SET "productCode" = productcode::text';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='countedBoxes'
  ) THEN
    ALTER TABLE public.app_physical_count ADD COLUMN "countedBoxes" numeric;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='countedboxes'
    ) THEN
      EXECUTE 'UPDATE public.app_physical_count SET "countedBoxes" = countedboxes::numeric';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='countedAt'
  ) THEN
    ALTER TABLE public.app_physical_count ADD COLUMN "countedAt" timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  -- app_audit_log: asegurar columna createdAt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_audit_log' AND column_name='createdAt'
  ) THEN
    ALTER TABLE public.app_audit_log ADD COLUMN "createdAt" timestamptz DEFAULT now();
  END IF;
END $$;