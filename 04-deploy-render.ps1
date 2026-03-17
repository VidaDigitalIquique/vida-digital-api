# 04-deploy-render.ps1
# Prepara y publica "vida-digital-api" para deploy en Render (Blueprints).
# - Genera/actualiza proyecto Node + Express con CORS y conexión Neon (read-only).
# - Crea render.yaml (plan free) y push a GitHub (si tienes gh CLI autenticado).
# - Luego en Render: New -> Blueprint -> eliges el repo -> Deploy.

$ErrorActionPreference = "Stop"

# =========================
# === CONFIGURACIONES ====
# =========================
# Nombre de carpeta/proyecto local:
$ProjectName = "vida-digital-api"

# Nombre del servicio en Render (aparece en el dashboard)
$RenderServiceName = "vida-digital-api"

# Nombre del repositorio en GitHub (se creará si tienes gh CLI autenticado)
$GitHubRepoName = "vida-digital-api"

# Si NO usas gh CLI, pon aquí tu remoto (p.ej. "https://github.com/usuario/vida-digital-api.git")
# Déjalo vacío si quieres que el script intente usar gh.
$GitRemote = ""

# URL de conexión Neon (read-only). Sin channel_binding para evitar incompatibilidades.
$NeonUrl = "postgresql://neondb_owner:npg_PaBxIdvm6oH7@ep-lucky-butterfly-acdie4l8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

# Whitelist de orígenes (cuando desactives CORS_ANY en Render)
$AllowedOrigins = @("https://aistudio.google.com","https://ai.google.dev")

# Node.js start command (Render usará este comando)
$StartCommand = "node index.js"

# =========================
# === PREPARAR PROYECTO ===
# =========================
$Root = Get-Location
$ProjectPath = Join-Path $Root $ProjectName
if (!(Test-Path $ProjectPath)) { New-Item -ItemType Directory -Path $ProjectPath | Out-Null }

# package.json
$packageJson = @"
{
  "name": "$ProjectName",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "$StartCommand"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "pg": "^8.11.5"
  }
}
"@
Set-Content -LiteralPath (Join-Path $ProjectPath "package.json") -Value $packageJson -Encoding UTF8

# .gitignore
$gitignore = @"
node_modules
.env
.DS_Store
npm-debug.log*
"@
Set-Content -LiteralPath (Join-Path $ProjectPath ".gitignore") -Value $gitignore -Encoding UTF8

# .env (solo local; en Render se setea como env var segura)
$envLocal = @"
PORT=4000
DATABASE_URL=$NeonUrl
# En producción (Render) se recomienda CORS_ANY=0 y agregar orígenes permitidos.
# Durante pruebas locales puedes dejarlo en 1 (pero Render lo manejará con envVars).
CORS_ANY=1
"@
Set-Content -LiteralPath (Join-Path $ProjectPath ".env") -Value $envLocal -Encoding UTF8

# index.js (API mínima con CORS y /products)
$indexJs = @"
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";

const app = express();

// CORS: en Render setea CORS_ANY=0 y limita orígenes; en local puedes usar 1.
const allowed = ${(@($AllowedOrigins) | ConvertTo-Json)};
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

// Pool a Neon (read-only). SSL requerido.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Health
app.get("/health", (_, res) => res.json({ status: "ok" }));

// === SQL (ajusta campos/esquema según tu espejo) ===
const SQL_PRODUCTS = `
  SELECT
    p.codunico      AS code,
    p.descripcion   AS descripcion,
    p.marca         AS marca,
    p.categoria     AS categoria,
    p.stocdisp      AS stock_unidades,   -- TODO confirma campo real
    p.costoun       AS costo,            -- TODO confirma
    p.precio1       AS precio1,          -- TODO confirma
    p.updated_at    AS updated_at        -- TODO confirma
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
      total: rows.length,
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
      "code","descripcion","marca","categoria","stock_unidades","costo","precio1","updated_at"
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
  console.log(`API listening on :\${port}`);
});
"@
Set-Content -LiteralPath (Join-Path $ProjectPath "index.js") -Value $indexJs -Encoding UTF8

# render.yaml (Blueprint)
$renderYaml = @"
services:
  - type: web
    name: $RenderServiceName
    env: node
    plan: free
    autoDeploy: true
    buildCommand: "npm install"
    startCommand: "$StartCommand"
    healthCheckPath: "/health"
    # Render provee PORT por env; el server ya lo respeta.
    envVars:
      - key: DATABASE_URL
        value: "$NeonUrl"
      - key: CORS_ANY
        value: "0"
"@
Set-Content -LiteralPath (Join-Path $ProjectPath "render.yaml") -Value $renderYaml -Encoding UTF8

# =========================
# ===== INIT & PUSH =======
# =========================
Push-Location $ProjectPath

# Inicializa git si no existe
if (!(Test-Path (Join-Path $ProjectPath ".git"))) {
  git init | Out-Null
  git add . | Out-Null
  git commit -m "chore: initial Render blueprint setup" | Out-Null
} else {
  git add . | Out-Null
  git commit -m "chore: update Render blueprint & API" | Out-Null
}

# Usa gh CLI si está disponible y no hay remoto configurado
function HasRemote {
  try {
    $remotes = git remote
    return ($remotes -ne $null -and $remotes.Trim().Length -gt 0)
  } catch { return $false }
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not (HasRemote)) {
  if ($gh) {
    Write-Host "Creando repo GitHub '$GitHubRepoName' con gh CLI..." -ForegroundColor Cyan
    gh repo create $GitHubRepoName --private --source "." --remote origin --push --description "Vida Digital API (Render blueprint)" | Out-Null
  } elseif ($GitRemote -ne "") {
    Write-Host "Agregando remoto '$GitRemote'..." -ForegroundColor Cyan
    git remote add origin $GitRemote
    git branch -M main
    git push -u origin main
  } else {
    Write-Warning "No se encontró gh CLI ni definiste GitRemote. Agrega remoto manualmente:"
    Write-Host "  git remote add origin https://github.com/<usuario>/$GitHubRepoName.git" -ForegroundColor Yellow
    Write-Host "  git branch -M main" -ForegroundColor Yellow
    Write-Host "  git push -u origin main" -ForegroundColor Yellow
  }
} else {
  # Si ya hay remoto, simplemente pushea
  git push -u origin main
}

Pop-Location

Write-Host "`n✅ Listo. Siguiente paso:" -ForegroundColor Green
Write-Host "1) Ve a https://dashboard.render.com → New → Blueprint" -ForegroundColor Green
Write-Host "2) Conecta tu GitHub y elige el repo '$GitHubRepoName'." -ForegroundColor Green
Write-Host "3) Render leerá render.yaml y hará el deploy (plan free)." -ForegroundColor Green
Write-Host "4) Obtendrás una URL pública HTTPS. Úsala en tu frontend (AI Studio)." -ForegroundColor Green
