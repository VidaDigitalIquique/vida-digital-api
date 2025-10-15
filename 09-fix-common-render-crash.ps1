# 09-fix-common-render-crash.ps1
# Convierte el server a CommonJS, arregla package.json y hace push para forzar redeploy en Render.

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 1) Entrar al proyecto
$Root = Get-Location
$Proj = Join-Path $Root "vida-digital-api"
if (!(Test-Path $Proj)) { Err "No encuentro carpeta 'vida-digital-api' en $Root"; exit 1 }
Set-Location $Proj

# 2) Asegurar package.json (sin "type":"module", con engines)
$pkgPath = Join-Path (Get-Location) "package.json"
if (!(Test-Path $pkgPath)) { Err "No hay package.json"; exit 1 }
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json

# eliminar "type":"module" si existe
if ($pkg.PSObject.Properties.Name -contains "type") { $pkg.PSObject.Properties.Remove("type") }

# engines node >=18
if (-not $pkg.PSObject.Properties.Name -contains "engines") { $pkg | Add-Member -NotePropertyName engines -NotePropertyValue (@{}) }
$pkg.engines = @{ node = ">=18" }

# scripts.start garantizado
if (-not $pkg.PSObject.Properties.Name -contains "scripts") { $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
$pkg.scripts.start = "node index.cjs"

# deps mínimas
if (-not $pkg.PSObject.Properties.Name -contains "dependencies") { $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue (@{}) }
$pkg.dependencies.cors = $pkg.dependencies.cors ?? "2.8.5"
$pkg.dependencies.dotenv = $pkg.dependencies.dotenv ?? "16.4.5"
$pkg.dependencies.express = $pkg.dependencies.express ?? "4.19.2"
$pkg.dependencies.pg = $pkg.dependencies.pg ?? "8.11.5"

# escribir package.json
($pkg | ConvertTo-Json -Depth 10) | Out-File -Encoding UTF8 $pkgPath

Ok "package.json actualizado (CommonJS + engines >=18 + start script)."

# 3) Reescribir server como CommonJS: index.cjs
$indexCjs = @'
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// CORS permisivo si CORS_ANY=1; de lo contrario, limita a hosts conocidos.
const allowed = ["https://aistudio.google.com","https://ai.google.dev"];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || process.env.CORS_ANY === "1") return cb(null, true);
      if (allowed.some((h) => origin.endsWith(h))) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: false,
  })
);

app.use(express.json());

// Pool a Neon (si DATABASE_URL no está, evitamos crashear)
const dbUrl = process.env.DATABASE_URL || "";
const pool = dbUrl
  ? new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  : null;

app.get("/", (_, res) => res.send("Vida Digital API up"));
app.get("/health", (_, res) => res.json({ status: "ok" }));

const SQL_PRODUCTS = `
  SELECT
    p.codunico      AS code,
    p.descripcion   AS descripcion,
    p.marca         AS marca,
    p.categoria     AS categoria,
    p.stocdisp      AS stock_unidades,
    p.costoun       AS costo,
    p.precio1       AS precio1,
    p.updated_at    AS updated_at
  FROM inventar.producto p
  WHERE ($1 = '' OR p.descripcion ILIKE '%'||$1||'%' OR p.codunico ILIKE '%'||$1||'%')
  ORDER BY p.descripcion
  LIMIT LEAST($2::int, 200)
  OFFSET GREATEST(($3::int - 1), 0) * $2::int
`;

app.get("/products", async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "no_database_url" });
    const q = String(req.query.query ?? "");
    const page = parseInt(req.query.page ?? "1", 10) || 1;
    const limit = parseInt(req.query.limit ?? "50", 10) || 50;
    const { rows } = await pool.query(SQL_PRODUCTS, [q, limit, page]);
    const stock_total_unidades = rows.reduce((a, r) => a + (Number(r.stock_unidades) || 0), 0);

    res.json({
      items: rows,
      page,
      limit,
      total: rows.length,
      kpis: { count_products: rows.length, stock_total_unidades },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "products_failed", detail: String(e?.message || e) });
  }
});

app.get("/products/export.csv", async (req, res) => {
  try {
    if (!pool) return res.status(500).send("no_database_url");
    const q = String(req.query.query ?? "");
    const { rows } = await pool.query(SQL_PRODUCTS, [q, 1000, 1]);

    const headers = ["code","descripcion","marca","categoria","stock_unidades","costo","precio1","updated_at"];
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
Set-Content -LiteralPath (Join-Path (Get-Location) "index.cjs") -Value $indexCjs -Encoding UTF8

# 4) Asegurar render.yaml (startCommand usa index.cjs y healthCheckPath /health)
$renderYamlPath = Join-Path (Get-Location) "render.yaml"
$renderYaml = @"
services:
  - type: web
    name: vida-digital-api
    env: node
    plan: free
    autoDeploy: true
    buildCommand: npm install
    startCommand: node index.cjs
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        value: "postgresql://neondb_owner:npg_PaBxIdvm6oH7@ep-lucky-butterfly-acdie4l8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
      - key: CORS_ANY
        value: "0"
"@
Set-Content -LiteralPath $renderYamlPath -Value $renderYaml -Encoding UTF8

# 5) Commit + push
git add .
git commit -m "fix: switch to CommonJS, engines>=18, start index.cjs"
git push

Ok "Cambios empujados. Render hará auto-redeploy."
Write-Host "Cuando termine, abre: https://<tu-subdominio>.onrender.com/health" -ForegroundColor Green
