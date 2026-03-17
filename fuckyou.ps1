# 15-patch-products-priority.ps1
# Reescribe src/index.cjs para que /products priorice sanjh.producto y vida.producto
# y, si existen ambas, combine los resultados (sin suponer esquema).
# También crea /products/sanjh y /products/vida.

$ErrorActionPreference = "Stop"

if (Test-Path "src/index.cjs") {
  Copy-Item "src/index.cjs" "src/index.cjs.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))" -Force
} else {
  New-Item -ItemType Directory -Force -Path "src" | Out-Null
}

$index = @'
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[BOOT] FALTA env DATABASE_URL");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon
});

app.get("/", (req, res) => {
  res.status(200).json({ ok: true, service: "vida-digital-api", entrypoint: __filename });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

async function tableExists(qualified) {
  const [schema, table] = qualified.split(".");
  const { rows } = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`${schema}.${table}`]);
  return rows?.[0]?.exists === true;
}

app.get("/db/diag", async (_req, res) => {
  try {
    const q = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type='BASE TABLE'
        AND table_schema IN ('public','sanjh','vida')
      ORDER BY table_schema, table_name
      LIMIT 200;
    `;
    const { rows } = await pool.query(q);
    res.json({ ok: true, tables: rows });
  } catch (e) {
    console.error("[/db/diag] error:", e);
    res.status(500).json({ ok: false, error: "diag_failed", detail: String(e) });
  }
});

// Utilidad pequeña para paginar
function parseLimitOffset(req) {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  return { limit, offset };
}

// Fuente directa por schema (sanjh|vida)
async function fetchFrom(schema, limit, offset) {
  // NO parametrizamos el nombre de tabla (constante) y sí parametrizamos limit/offset
  const sql = `SELECT * FROM ${schema}.producto LIMIT $1 OFFSET $2`;
  console.info(`[products:${schema}] SQL =>`, sql, { limit, offset });
  const { rows } = await pool.query(sql, [limit, offset]);
  // Adjuntamos la fuente para que el cliente sepa de dónde viene cada fila
  return rows.map(r => ({ __source: `${schema}.producto`, ...r }));
}

// /products: prioriza sanjh.producto y vida.producto; combina si ambas existen
app.get("/products", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req);
    const hasSanjh = await tableExists("sanjh.producto");
    const hasVida  = await tableExists("vida.producto");

    if (!hasSanjh && !hasVida) {
      return res.status(404).json({
        ok: false,
        error: "products_source_not_found",
        detail: "No existen sanjh.producto ni vida.producto",
      });
    }

    let data = [];
    if (hasSanjh) data = data.concat(await fetchFrom("sanjh", limit, offset));
    if (hasVida)  data = data.concat(await fetchFrom("vida",  limit, offset));

    // Nota: como combinamos en memoria, el total es la suma simple de ambos bloques.
    res.json({ ok: true, combined: true, count: data.length, data });
  } catch (e) {
    console.error("[/products] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

// Rutas directas si quieres consultar solo una fuente
app.get("/products/sanjh", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req);
    if (!(await tableExists("sanjh.producto"))) {
      return res.status(404).json({ ok: false, error: "not_found", detail: "sanjh.producto no existe" });
    }
    const data = await fetchFrom("sanjh", limit, offset);
    res.json({ ok: true, source: "sanjh.producto", count: data.length, data });
  } catch (e) {
    console.error("[/products/sanjh] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.get("/products/vida", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req);
    if (!(await tableExists("vida.producto"))) {
      return res.status(404).json({ ok: false, error: "not_found", detail: "vida.producto no existe" });
    }
    const data = await fetchFrom("vida", limit, offset);
    res.json({ ok: true, source: "vida.producto", count: data.length, data });
  } catch (e) {
    console.error("[/products/vida] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`[BOOT] API up on port ${PORT} | entrypoint=${__filename}`);
});
'@

Set-Content -Path "src/index.cjs" -Value $index -Encoding UTF8 -Force

# Forzar script start correcto en package.json
if (-not (Test-Path "package.json")) {
  $pkg = @{
    name = "vida-digital-api"
    private = $true
    version = "0.0.0"
    type = "commonjs"
    scripts = @{ start = "node src/index.cjs" }
    dependencies = @{ express = "^4.19.2"; pg = "^8.11.5" }
  } | ConvertTo-Json -Depth 6
  Set-Content -Path "package.json" -Value $pkg -Encoding UTF8 -Force
} else {
  $json = Get-Content "package.json" -Raw | ConvertFrom-Json
  if (-not $json.scripts) { $json | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
  $json.scripts.start = "node src/index.cjs"
  if (-not $json.dependencies) { $json | Add-Member -NotePropertyName dependencies -NotePropertyValue (@{}) }
  if ($json.dependencies.express -eq $null) { $json.dependencies.express = "^4.19.2" }
  if ($json.dependencies.pg -eq $null) { $json.dependencies.pg = "^8.11.5" }
  ($json | ConvertTo-Json -Depth 10) | Set-Content -Path "package.json" -Encoding UTF8 -Force
}

Write-Host "Listo ✅  -> /products ahora prioriza sanjh.producto y vida.producto (y las combina)."
Write-Host "Haz git add/commit/push y redeploy en Render (Start command: node src/index.cjs)."