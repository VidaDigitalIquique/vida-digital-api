const { Client } = require("pg");
const fs = require("fs");
require("dotenv").config();

const sql = `
BEGIN;

-- app_location: crear y/o completar columnas clave
CREATE TABLE IF NOT EXISTS public.app_location (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT,
  notes TEXT,
  createdat TIMESTAMP NOT NULL DEFAULT now(),
  updatedat TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE public.app_location ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.app_location ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.app_location ADD COLUMN IF NOT EXISTS createdat TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE public.app_location ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE public.app_location ALTER COLUMN updatedat SET DEFAULT now();
UPDATE public.app_location SET updatedat = COALESCE(updatedat, now());

-- app_physical_count: crear y/o completar columnas esperadas por el backend
CREATE TABLE IF NOT EXISTS public.app_physical_count (
  id TEXT PRIMARY KEY,
  "productCode" TEXT,
  location_id TEXT NOT NULL,
  "countedBoxes" NUMERIC,
  "countedAt" TIMESTAMP DEFAULT now(),
  note TEXT
);

ALTER TABLE public.app_physical_count ADD COLUMN IF NOT EXISTS "productCode" TEXT;
ALTER TABLE public.app_physical_count ADD COLUMN IF NOT EXISTS location_id TEXT NOT NULL;
ALTER TABLE public.app_physical_count ADD COLUMN IF NOT EXISTS "countedBoxes" NUMERIC;
ALTER TABLE public.app_physical_count ADD COLUMN IF NOT EXISTS "countedAt" TIMESTAMP DEFAULT now();
ALTER TABLE public.app_physical_count ADD COLUMN IF NOT EXISTS note TEXT;

-- si existían columnas en minúsculas, copiar datos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='productcode'
  ) THEN
    EXECUTE 'UPDATE public.app_physical_count SET "productCode" = productcode::text WHERE "productCode" IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='app_physical_count' AND column_name='countedboxes'
  ) THEN
    EXECUTE 'UPDATE public.app_physical_count SET "countedBoxes" = countedboxes::numeric WHERE "countedBoxes" IS NULL';
  END IF;
END $$;

-- índices útiles
CREATE INDEX IF NOT EXISTS app_physical_count_productCode_idx ON public.app_physical_count("productCode");
CREATE INDEX IF NOT EXISTS app_physical_count_location_id_idx ON public.app_physical_count(location_id);

COMMIT;
`;

(async () => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no está definido en .env");

    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log("OK: fix SQL aplicado");
  } catch (err) {
    console.error("FAIL:", err.message);
    process.exit(1);
  }
})();