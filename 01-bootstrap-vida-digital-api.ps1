# 01-bootstrap-vida-digital-api.ps1
# Uso:
#   1) Ajusta $NeonUrl si lo necesitas.
#   2) Ejecuta:  powershell -ExecutionPolicy Bypass -File .\01-bootstrap-vida-digital-api.ps1
#   3) Abre http://localhost:4000/health  → {"status":"ok"}

$ErrorActionPreference = "Stop"

# === Ajusta tu cadena Neon (read-only). Recomendado: sin channel_binding ===
$NeonUrl = "postgresql://neondb_owner:npg_PaBxIdvm6oH7@ep-lucky-butterfly-acdie4l8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

# === Ruta del proyecto ===
$Project = Join-Path (Get-Location) "vida-digital-api"
if (!(Test-Path $Project)) { New-Item -ItemType Directory -Path $Project | Out-Null }

# --- package.json ---
$packageJson = @'
{
  "name": "vida-digital-api",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "pg": "^8.11.5"
  }
}
'@
Set-Content -LiteralPath (Join-Path $Project "package.json") -Value $packageJson -Encoding UTF8

# --- .env ---
$envFile = @"
PORT=4000
DATABASE_URL=$NeonUrl
# Durante pruebas, permite cualquier origen:
CORS_ANY=1
"@
Set-Content -LiteralPath (Join-Path $Project ".env") -Value $envFile -Encoding UTF8

# --- index.js ---
$indexJs = @'
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";

const app = express();

// CORS: en pruebas puedes dejar CORS_ANY=1; en prod restringe orígenes.
const allowed = ["https://aistudio.google.com", "https://ai.google.dev"];
app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        process.env.CORS_ANY === "1" ||
        allowed.some((h) => origin.endsWith(h))
      ) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: false,
  })
);

app.use(express.json());

// Pool a Neon (read-only). ssl requerido en Neon:
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Health
app.get("/health", (_, res) => res.json({ status: "ok" }));

// --- SQL: AJUSTA NOMBRES REALES DE ESQUEMA/CAMPOS SEGÚN TU ESPEJO ---
const SQL_PRODUCTS = `
  SELECT
    p.codunico      AS code,
    p.descripcion   AS descripcion,
    p.marca         AS marca,
    p.categoria     AS categoria,
    p.stocdisp      AS stock_unidades,   -- TODO: confirma
    p.costoun       AS costo,            -- TODO: confirma
    p.precio1       AS precio1,          -- TODO: confirma
    p.updated_at    AS updated_at        -- TODO: confirma
  FROM inventar.producto p
  WHERE ($1 = '' OR p.descripcion ILIKE '%'||$1||'%' OR p.codunico ILIKE '%'||$1||'%')
  ORDER BY p.descripcion
  LIMIT LEAST($2::int, 200)
  OFFSET GREATEST(($3::int - 1), 0) * $2::int
`;

// GET /products
app.get("/products", async (req, res) => {
  try {
    const q = String(req.query.query ?? "");
    const page = parseInt(req.query.page ?? "1", 10) || 1;
    const limit = parseInt(req.query.limit ?? "50", 10) || 50;

    const { rows } = await pool.query(SQL_PRODUCTS, [q, limit, page]);

    const stock_total_unidades = rows.reduce(
      (a, r) => a + (Number(r.stock_unidades) || 0),
      0
    );

    res.json({
      items: rows,
      page,
      limit,
      total: rows.length, // Si necesitas total real, haz COUNT(*) aparte
      kpis: { count_products: rows.length, stock_total_unidades },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "products_failed", detail: String(e?.message || e) });
  }
});

// GET /products/export.csv
app.get("/products/export.csv", async (req, res) => {
  try {
    const q = String(req.query.query ?? "");
    const { rows } = await pool.query(SQL_PRODUCTS, [q, 1000, 1]);

    const headers = [
      "code",
      "descripcion",
      "marca",
      "categoria",
      "stock_unidades",
      "costo",
      "precio1",
      "updated_at",
    ];

    const lines = [headers.join(",")].concat(
      rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))
    );
    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="precios.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).send("csv_failed");
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
'@
Set-Content -LiteralPath (Join-Path $Project "index.js") -Value $indexJs -Encoding UTF8

# --- NPM install + start ---
Push-Location $Project
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm no está instalado o no está en PATH."
}
npm install
npm start
Pop-Location

Write-Host "`nListo. Revisa http://localhost:4000/health y /products" -ForegroundColor Green
