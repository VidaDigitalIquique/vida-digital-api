-- Asegura columnas camelCase que usa el código
ALTER TABLE IF EXISTS app_location
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS app_location_code_key ON app_location(code);

ALTER TABLE IF EXISTS app_physical_count
  ADD COLUMN IF NOT EXISTS "productCode" TEXT NOT NULL DEFAULT '',
  ALTER COLUMN "productCode" DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "countedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS app_physical_count_productCode_idx ON app_physical_count("productCode");
CREATE INDEX IF NOT EXISTS app_physical_count_location_id_idx ON app_physical_count(location_id);
CREATE INDEX IF NOT EXISTS app_physical_count_countedByUserId_idx ON app_physical_count("countedByUserId");

ALTER TABLE IF EXISTS app_audit_log
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS app_audit_log_actorUserId_idx ON app_audit_log("actorUserId");