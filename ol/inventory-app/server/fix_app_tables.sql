DO $$
BEGIN
  -- app_location: asegurar timestamps con default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_location' AND column_name='createdat'
  ) THEN
    ALTER TABLE public.app_location ADD COLUMN "createdat" TIMESTAMP NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_location' AND column_name='updatedat'
  ) THEN
    ALTER TABLE public.app_location ADD COLUMN "updatedat" TIMESTAMP NOT NULL DEFAULT now();
  END IF;

  ALTER TABLE public.app_location ALTER COLUMN "updatedat" SET DEFAULT now();
  UPDATE public.app_location SET "updatedat" = COALESCE("updatedat", now());
END $$;

DO $$
BEGIN
  -- app_physical_count: asegurar columnas con nombres esperados
  -- productCode
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

  -- countedBoxes
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

  -- countedAt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='countedAt'
  ) THEN
    ALTER TABLE public.app_physical_count ADD COLUMN "countedAt" TIMESTAMP DEFAULT now();
  END IF;
END $$;