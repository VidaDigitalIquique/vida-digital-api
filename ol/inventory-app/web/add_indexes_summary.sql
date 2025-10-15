CREATE INDEX IF NOT EXISTS idx_physical_count_prod_loc
  ON app_physical_count("productCode", "location_id");
CREATE INDEX IF NOT EXISTS idx_physical_count_prod_countedAt
  ON app_physical_count("productCode", "countedAt" DESC);