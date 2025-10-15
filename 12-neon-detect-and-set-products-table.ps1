# 12-neon-detect-and-set-products-table.ps1
# 1) Detecta tablas candidatas en Neon (psql o /db/diag)
# 2) Te deja elegir una (schema.table)
# 3) Escribe PRODUCTS_TABLE en render.yaml, commit + push y prueba /products

$ErrorActionPreference = "Stop"
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# === Config editables ===
# Tu URL pública del backend en Render:
$API_BASE = "https://vida-digital-api.onrender.com"
# Tu cadena de conexión Neon (puedes pegar otra si cambió):
$NEON_URL = "postgresql://neondb_owner:npg_PaBxIdvm6oH7@ep-lucky-butterfly-acdie4l8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
# Patrón de búsqueda para tablas:
$TABLE_PATTERN = "%producto%"

# === Ir al proyecto ===
$root = Get-Location
$proj = Join-Path $root "vida-digital-api"
if (!(Test-Path $proj)) { Err "No encuentro 'vida-digital-api' en $root"; exit 1 }
Set-Location $proj

# === Recolectar candidatas (psql primero, si no, /db/diag) ===
$candidates = @()
$usedPsql = $false

try {
  # ¿hay psql?
  $psql = Get-Command psql -ErrorAction SilentlyContinue
  if ($psql) {
    Info "Usando psql para consultar Neon..."
    $sql = @"
SELECT schemaname, tablename
FROM pg_catalog.pg_tables
WHERE tablename ILIKE '$TABLE_PATTERN' OR tablename ILIKE '%product%' OR tablename ILIKE '%productos%'
ORDER BY schemaname, tablename
LIMIT 200;
"@
    $tmpFile = New-TemporaryFile
    $sql | Out-File -Encoding UTF8 $tmpFile
    $out = & psql "$NEON_URL" -f $tmpFile.FullName -A -F ',' 2>$null
    Remove-Item $tmpFile -Force

    foreach ($line in $out) {
      if ($line -match "^[a-zA-Z0-9_]+,[a-zA-Z0-9_]+$") {
        $parts = $line.Split(',')
        $candidates += "$($parts[0]).$($parts[1])"
      }
    }
    $usedPsql = $true
  }
} catch { }

if (-not $usedPsql) {
  Info "psql no disponible o bloqueado — consulto $API_BASE/db/diag ..."
  try {
    $r = Invoke-WebRequest "$API_BASE/db/diag" -UseBasicParsing -TimeoutSec 30
    $json = $null
    try { $json = $r.Content | ConvertFrom-Json } catch {}
    if ($json -and $json.candidate_tables) {
      foreach ($row in $json.candidate_tables) {
        $candidates += "$($row.schemaname).$($row.tablename)"
      }
      if ($json.products_table_env) {
        Warn "Valor actual de PRODUCTS_TABLE en server: $($json.products_table_env)"
      }
    } else {
      Warn "No pude leer candidatos desde /db/diag."
    }
  } catch {
    Err "Fallo al consultar $API_BASE/db/diag: $($_.Exception.Message)"
  }
}

$candidates = $candidates | Sort-Object -Unique
if ($candidates.Count -eq 0) {
  Err "No encontré tablas candidatas. Ajusta TABLE_PATTERN o pásame un nombre exacto."
  exit 1
}

Write-Host "`nTablas candidatas encontradas:" -ForegroundColor Cyan
for ($i=0; $i -lt $candidates.Count; $i++) {
  Write-Host ("[{0}] {1}" -f ($i+1), $candidates[$i])
}

# Elegir una
$sel = Read-Host "`nElige el número de la tabla a usar como PRODUCTS_TABLE"
if (-not $sel -or -not ($sel -as [int]) -or $sel -lt 1 -or $sel -gt $candidates.Count) {
  Err "Selección inválida."
  exit 1
}
$chosen = $candidates[$sel-1]
Ok "Elegida: $chosen"

# === Actualizar render.yaml (env var PRODUCTS_TABLE) ===
$renderPath = Join-Path (Get-Location) "render.yaml"
if (!(Test-Path $renderPath)) { Err "No existe render.yaml aquí."; exit 1 }
$yaml = Get-Content $renderPath -Raw

if ($yaml -match "key:\s*PRODUCTS_TABLE") {
  # Reemplazo del valor actual
  $yaml = [regex]::Replace($yaml, "(?ms)(-+\s*key:\s*PRODUCTS_TABLE\s*[\r\n]+?\s*value:\s*\"?)([^\" \r\n]+)(\"?)", "`$1$chosen`$3")
} else {
  # Inserto nueva entrada bajo envVars:
  $insertion = @"
      - key: PRODUCTS_TABLE
        value: "$chosen"
"@
  if ($yaml -match "envVars:\s*[\r\n]+") {
    $yaml = $yaml -replace "(envVars:\s*[\r\n]+)", "`$1$insertion"
  } else {
    Warn "No encontré 'envVars:' en render.yaml; lo agregaré."
    $yaml += @"

    envVars:
      - key: PRODUCTS_TABLE
        value: "$chosen"
"
  }
}
Set-Content -Encoding UTF8 -LiteralPath $renderPath -Value $yaml

# === Commit + push (redeploy) ===
git add render.yaml
git commit -m "chore: set PRODUCTS_TABLE to $chosen"
git push
Ok "Cambios empujados. Render hará auto-redeploy."

# === Probar /products cuando levante ===
Write-Host "`nCuando Render quede LIVE, probaré /products..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
try {
  $ok = $false
  for ($i=1; $i -le 30; $i++) {
    try {
      $r = Invoke-WebRequest "$API_BASE/health" -UseBasicParsing -TimeoutSec 10
      if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch {}
    Start-Sleep -Seconds 5
  }
  if ($ok) {
    $p = Invoke-WebRequest "$API_BASE/products" -UseBasicParsing -TimeoutSec 30
    if ($p.StatusCode -eq 200) { Ok "/products OK → JSON recibido" } else { Err "/products → $($p.StatusCode)" }
  } else {
    Warn "No pude confirmar /health aún; abre el dashboard de Render para ver el redeploy."
  }
} catch {
  Err "Prueba falló: $($_.Exception.Message)"
}
