# 18-deploy-render-vida.ps1
# PowerShell 5.1 compatible – Sin '??'
# Hace:
#  - Crea/actualiza src/index.cjs con /, /health, /db/diag, /products (sanjh/vida)
#  - Asegura package.json, .env.example, .gitignore
#  - npm install si falta
#  - Inicializa Git (si no existe), setea origin, rama main, add/commit/pull --rebase/push
#  - Muestra pasos finales para Render

$ErrorActionPreference = "Stop"

# ---------- CONFIG ----------
$REMOTE = "https://github.com/VidaDigitaliquique/vida-digital-api.git"
$BRANCH = "main"
$COMMIT_MSG = "deploy(api): entrypoint + /db/diag + /products (sanjh/vida)"
# ----------------------------

# 0) Carpetas y backups
if (-not (Test-Path "src")) { New-Item -ItemType Directory -Path "src" | Out-Null }
if (Test-Path "src/index.cjs") {
  Copy-Item "src/index.cjs" ("src/index.cjs.bak.{0}" -f (Get-Date -Format "yyyyMMddHHmmss")) -Force
}

# 1) index.cjs (prioriza sanjh/vida)
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
  const parts = qualified.split(".");
  const schema = parts[0]; const table = parts[1];
  const { rows } = await pool.query("SELECT to_regclass($1) IS NOT NULL AS exists", [schema + "." + table]);
  return rows && rows[0] && rows[0].exists === true;
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

function parseLimitOffset(req) {
  var limit = parseInt((req.query && req.query.limit) ? req.query.limit : "50", 10); if (!limit) limit = 50;
  var offset = parseInt((req.query && req.query.offset) ? req.query.offset : "0", 10); if (!offset) offset = 0;
  limit = Math.max(1, Math.min(100, limit));
  offset = Math.max(0, offset);
  return { limit: limit, offset: offset };
}

async function fetchFrom(schema, limit, offset) {
  const sql = "SELECT * FROM " + schema + ".producto LIMIT $1 OFFSET $2";
  console.info("[/products] SQL =>", sql, { schema, limit, offset });
  const { rows } = await pool.query(sql, [limit, offset]);
  return rows.map(function(r){ return Object.assign({ __source: schema + ".producto" }, r); });
}

app.get("/products", async (req, res) => {
  try {
    const lo = parseLimitOffset(req);
    const hasSanjh = await tableExists("sanjh.producto");
    const hasVida  = await tableExists("vida.producto");

    if (!hasSanjh && !hasVida) {
      return res.status(404).json({ ok: false, error: "products_source_not_found", detail: "No existen sanjh.producto ni vida.producto" });
    }

    let data = [];
    if (hasSanjh) data = data.concat(await fetchFrom("sanjh", lo.limit, lo.offset));
    if (hasVida)  data = data.concat(await fetchFrom("vida",  lo.limit, lo.offset));

    res.json({ ok: true, combined: true, count: data.length, data: data });
  } catch (e) {
    console.error("[/products] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.get("/products/sanjh", async (req, res) => {
  try {
    const lo = parseLimitOffset(req);
    if (!(await tableExists("sanjh.producto"))) {
      return res.status(404).json({ ok: false, error: "not_found", detail: "sanjh.producto no existe" });
    }
    const data = await fetchFrom("sanjh", lo.limit, lo.offset);
    res.json({ ok: true, source: "sanjh.producto", count: data.length, data: data });
  } catch (e) {
    console.error("[/products/sanjh] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.get("/products/vida", async (req, res) => {
  try {
    const lo = parseLimitOffset(req);
    if (!(await tableExists("vida.producto"))) {
      return res.status(404).json({ ok: false, error: "not_found", detail: "vida.producto no existe" });
    }
    const data = await fetchFrom("vida", lo.limit, lo.offset);
    res.json({ ok: true, source: "vida.producto", count: data.length, data: data });
  } catch (e) {
    console.error("[/products/vida] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.listen(PORT, () => {
  console.log("[BOOT] API up on port " + PORT + " | entrypoint=" + __filename);
});
'@
Set-Content -Path "src/index.cjs" -Value $index -Encoding UTF8 -Force

# 2) package.json
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
  if (-not $json.dependencies.express) { $json.dependencies.express = "^4.19.2" }
  if (-not $json.dependencies.pg) { $json.dependencies.pg = "^8.11.5" }
  ($json | ConvertTo-Json -Depth 10) | Set-Content -Path "package.json" -Encoding UTF8 -Force
}

# 3) .env.example y .gitignore
@'
# Copia a .env si quieres probar local.
# Render debe tener DATABASE_URL en Environment.
DATABASE_URL=postgresql://USER:PASS@HOST/neondb?sslmode=require&channel_binding=require
'@ | Set-Content -Path ".env.example" -Encoding UTF8 -Force

if (-not (Test-Path ".gitignore")) {
@'
node_modules/
dist/
build/
.env
npm-debug.log*
yarn-error.log*
'@ | Set-Content -Path ".gitignore" -Encoding UTF8 -Force
}

# 4) npm install si falta
if (-not (Test-Path "node_modules")) { npm install }

# 5) Git: init / remoto / rama / commit / pull --rebase / push
if (-not (Test-Path ".git")) {
  git init | Out-Null
  # Config mínima si falta
  try { git config user.name | Out-Null } catch { git config user.name "Pablo" }
  try { git config user.email | Out-Null } catch { git config user.email "vidadigitaliquique@gmail.com" }
  git checkout -b $BRANCH 2>$null | Out-Null
  git remote add origin $REMOTE
} else {
  # Si no hay remote origin, añadir
  $remotes = (git remote) -split "\r?\n"
  if (-not ($remotes -contains "origin")) {
    git remote add origin $REMOTE
  } else {
    # Si origin apunta a otra URL, la reemplazamos
    $originUrl = (git remote get-url origin).Trim()
    if ($originUrl -ne $REMOTE) {
      git remote set-url origin $REMOTE
    }
  }
  # Asegurar que estamos en BRANCH
  $cur = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($cur -ne $BRANCH) { git checkout $BRANCH }
}

git add -A
try {
  git commit -m $COMMIT_MSG | Out-Null
} catch {
  Write-Host "Nada nuevo para commitear (posible)."
}

# Intentar rebase para alinear con remoto si ya existe historial
$pulled = $true
try { git pull --rebase origin $BRANCH } catch { $pulled = $false }

# Push con upstream
try {
  git push -u origin $BRANCH
} catch {
  Write-Warning "El push falló. Si quieres sobrescribir el remoto con tu estado local (FORCE):"
  Write-Host "  git push -u origin $BRANCH --force"
  throw
}

Write-Host "`nListo ✅ Código empujado a $REMOTE ($BRANCH)."
Write-Host "En Render:"
Write-Host "  • Settings → Start command: node src/index.cjs"
Write-Host "  • Environment → DATABASE_URL (Neon con sslmode=require&channel_binding=require)"
Write-Host "  • Manual Deploy → Clear build cache & Deploy"
Write-Host "Luego prueba:"
Write-Host '  Invoke-WebRequest https://vida-digital-api.onrender.com/health | Select-Object StatusCode,Content'
Write-Host '  Invoke-WebRequest https://vida-digital-api.onrender.com/db/diag  | Select-Object StatusCode,Content'
Write-Host '  Invoke-WebRequest "https://vida-digital-api.onrender.com/products?limit=20" | Select-Object StatusCode,Content'
