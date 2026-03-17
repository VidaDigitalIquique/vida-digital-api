CREATE TABLE IF NOT EXISTS app_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL,
  passwordHash TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS app_location (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS app_product_meta (
  id TEXT PRIMARY KEY,
  "productCode" TEXT NOT NULL,
  "imageUrl" TEXT,
  "qtyPerBoxOverride" INTEGER,
  observations TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS app_product_meta_productCode_idx ON app_product_meta("productCode");

CREATE TABLE IF NOT EXISTS app_physical_count (
  id TEXT PRIMARY KEY,
  "productCode" TEXT NOT NULL,
  location_id TEXT NOT NULL,
  "countedBoxes" NUMERIC(12,2) NOT NULL,
  "countedByUserId" TEXT,
  "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);
CREATE INDEX IF NOT EXISTS app_physical_count_productCode_idx ON app_physical_count("productCode");
CREATE INDEX IF NOT EXISTS app_physical_count_location_id_idx ON app_physical_count(location_id);
CREATE INDEX IF NOT EXISTS app_physical_count_countedByUserId_idx ON app_physical_count("countedByUserId");

CREATE TABLE IF NOT EXISTS app_audit_log (
  id TEXT PRIMARY KEY,
  "actorUserId" TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entityId TEXT NOT NULL,
  diff JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS app_audit_log_actorUserId_idx ON app_audit_log("actorUserId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_physical_count_location_id_fkey') THEN
    ALTER TABLE app_physical_count
      ADD CONSTRAINT app_physical_count_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES app_location(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_physical_count_countedByUserId_fkey') THEN
    ALTER TABLE app_physical_count
      ADD CONSTRAINT app_physical_count_countedByUserId_fkey
      FOREIGN KEY ("countedByUserId") REFERENCES app_user(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_audit_log_actorUserId_fkey') THEN
    ALTER TABLE app_audit_log
      ADD CONSTRAINT app_audit_log_actorUserId_fkey
      FOREIGN KEY ("actorUserId") REFERENCES app_user(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;