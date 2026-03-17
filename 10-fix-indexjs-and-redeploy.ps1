# 10-fix-indexjs-and-redeploy.ps1
# Reescribe index.js (CommonJS), ajusta package.json (sin type:module, start=node index.js),
# asegura dependencias y engines, y hace push para forzar redeploy en Render.

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 1) Entrar al proyecto
$root = Get-Location
$proj = Join-Path $root "vida-digital-api"
if (!(Test-Path $proj)) { Err "No encuentro carpeta 'vida-digital-api' en $root"; exit 1 }
Set-Location $proj

# 2) Escribir index.js (CommonJS 100% válido)
$indexJs = @'
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// CORS: durante pruebas CORS_ANY=1 permite todo; en prod limita a estos hosts:
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

// DB pool (read-only Neon). Si falta DATABASE_URL, no rompemos /health.
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
Set-Content -Encoding UTF8 -LiteralPath (Join-Path (Get-Location) "index.js") -Value $indexJs

# 3) Arreglar package.json
$pkgPath = Join-Path (Get-Location) "package.json"
if (!(Test-Path $pkgPath)) { Err "No hay package.json"; exit 1 }
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json

# quitar "type": "module" si existe
if ($pkg.PSObject.Properties.Name -contains "type") { $pkg.PSObject.Properties.Remove("type") }

# scripts.start = node index.js
if (-not ($pkg.PSObject.Properties.Name -contains "scripts")) { $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
$pkg.scripts.start = "node index.js"

# engines.node >= 18
if (-not ($pkg.PSObject.Properties.Name -contains "engines")) { $pkg | Add-Member -NotePropertyName engines -NotePropertyValue (@{}) }
$pkg.engines = @{ node = ">=18" }

# asegurar deps mínimas
if (-not ($pkg.PSObject.Properties.Name -contains "dependencies")) { $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue (@{}) }
$deps = @{ cors="2.8.5"; dotenv="16.4.5"; express="4.19.2"; pg="8.11.5" }
foreach ($k in $deps.Keys) {
  if (-not ($pkg.dependencies.PSObject.Properties.Name -contains $k)) {
    $pkg.dependencies | Add-Member -NotePropertyName $k -NotePropertyValue $deps[$k]
  }
}

# guardar
($pkg | ConvertTo-Json -Depth 20) | Out-File -Encoding UTF8 $pkgPath

# 4) Commit + push
git add .
git commit -m "fix: use CommonJS index.js and start=node index.js; engines>=18"
git push

Ok "Cambios empujados. Render hará auto-redeploy. Abre los Logs y espera 'API listening on :<PORT>'."
