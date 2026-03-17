# 09b-fix-common-render-crash-ps5.ps1
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 1) Proyecto
$root = Get-Location
$proj = Join-Path $root "vida-digital-api"
if (!(Test-Path $proj)) { Err "No encuentro 'vida-digital-api' en $root"; exit 1 }
Set-Location $proj

# 2) package.json (sin "type":"module", con engines y start)
$pkgPath = Join-Path (Get-Location) "package.json"
if (!(Test-Path $pkgPath)) { Err "No hay package.json"; exit 1 }
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json

# Quitar type:"module"
if ($pkg.PSObject.Properties.Name -contains "type") { $pkg.PSObject.Properties.Remove("type") }

# engines.node >= 18
if (-not ($pkg.PSObject.Properties.Name -contains "engines")) { $pkg | Add-Member -NotePropertyName engines -NotePropertyValue (@{}) }
$pkg.engines = @{ node = ">=18" }

# scripts.start = node index.cjs
if (-not ($pkg.PSObject.Properties.Name -contains "scripts")) { $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
$pkg.scripts.start = "node index.cjs"

# dependencies mínimas
if (-not ($pkg.PSObject.Properties.Name -contains "dependencies")) { $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue (@{}) }
$deps = @{ cors="2.8.5"; dotenv="16.4.5"; express="4.19.2"; pg="8.11.5" }
foreach ($k in $deps.Keys) {
  if (-not ($pkg.dependencies.PSObject.Properties.Name -contains $k)) {
    $pkg.dependencies | Add-Member -NotePropertyName $k -NotePropertyValue $deps[$k]
  }
}

# Guardar package.json
($pkg | ConvertTo-Json -Depth 20) | Out-File -Encoding UTF8 $pkgPath
Ok "package.json actualizado."

# 3) index.cjs (CommonJS)
$indexCjs = @'
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const allowed = ["https://aistudio.google.com","https://ai.google.dev"];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || process.env.CORS_ANY === "1") return cb(null, true);
    if (allowed.some(h => origin.endsWith(h))) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: false
}));
app.use(express.json());

const dbUrl = process.env.DATABASE_URL || "";
const pool = dbUrl ? new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } }) : null;

app.get("/", (_, res) => res.send("Vida Digital API up"));
app.get("/health", (_, res) => res.json({ status: "ok" }));

const SQL_PRODUCTS = `
  SELECT
    p.codunico    AS code,
    p.descripcion AS descripcion,
    p.marca       AS marca,
    p.categoria   AS categoria,
    p.stocdisp    AS stock_unidades,
    p.costoun     AS costo,
    p.precio1     AS precio1,
    p.updated_at  AS updated_at
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
    res.json({ items: rows, page, limit, total: rows.length, kpis: { count_products: rows.length, stock_total_unidades } });
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
    const lines = [headers.join(",")].concat(rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(",")));
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition",'attachment; filename="precios.csv"');
    res.send(lines.join("\n"));
  } catch (e) {
    console.error(e);
    res.status(500).send("csv_failed");
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on :${port}`));
'@
Set-Content -LiteralPath (Join-Path (Get-Location) "index.cjs") -Value $indexCjs -Encoding UTF8
Ok "index.cjs escrito."

# 4) render.yaml (asegura startCommand/health/env)
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
$renderPath = Join-Path (Get-Location) "render.yaml"
Set-Content -LiteralPath $renderPath -Value $renderYaml -Encoding UTF8
Ok "render.yaml actualizado."

# 5) Commit + push
git add .
git commit -m "fix: PS5 compat, CommonJS server, start index.cjs, engines>=18"
git push
Ok "Cambios empujados. Render hará auto-redeploy."
Write-Host "Cuando Render termine, prueba: https://<tu-subdominio>.onrender.com/health" -ForegroundColor Green
