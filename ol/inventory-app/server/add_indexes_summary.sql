DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_app_physical_count_productcode'
  ) THEN
    EXECUTE 'CREATE INDEX idx_app_physical_count_productcode ON public.app_physical_count ("productCode")';
  END IF;
END $$;