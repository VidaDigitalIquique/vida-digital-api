# 12b-neon-set-products-table-ps5.ps1
# Lee tablas candidatas desde /db/diag, permite elegir una y escribe PRODUCTS_TABLE en render.yaml (PS5-safe).

$ErrorActionPreference = "Stop"
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# === Config ===
$API_BASE = "https://vida-digital-api.onrender.com"   # cambia si tu URL es distinta

# === Ir al proyecto ===
$root = Get-Location
$proj = Join-Path $root "vida-digital-api"
if (!(Test-Path $proj)) { Err "No encuentro 'vida-digital-api' en $root"; exit 1 }
Set-Location $proj

# === Obtener candidatas desde /db/diag ===
Info "Consultando $API_BASE/db/diag ..."
try {
  $r = Invoke-WebRequest "$API_BASE/db/diag" -UseBasicParsing -TimeoutSec 30
} catch {
  Err "No pude llamar /db/diag: $($_.Exception.Message). Verifica que el servicio esté Live."
  exit 1
}

$json = $null
try { $json = $r.Content | ConvertFrom-Json } catch {
  Err "No pude parsear JSON de /db/diag"; exit 1
}

$candidates = @()
if ($json -and $json.candidate_tables) {
  foreach ($row in $json.candidate_tables) {
    $candidates += ("{0}.{1}" -f $row.schemaname, $row.tablename)
  }
}
$candidates = $candidates | Sort-Object -Unique

if ($candidates.Count -eq 0) {
  Err "No hay tablas candidatas en /db/diag. Revisa tu Neon o pásame el nombre exacto."
  exit 1
}

Write-Host "`nTablas candidatas:" -ForegroundColor Cyan
for ($i=0; $i -lt $candidates.Count; $i++) {
  Write-Host ("[{0}] {1}" -f ($i+1), $candidates[$i])
}
if ($json.products_table_env) {
  Warn ("Valor actual PRODUCTS_TABLE (server): {0}" -f $json.products_table_env)
}

$sel = Read-Host "`nElige el número de la tabla a usar"
if (-not $sel -or -not ($sel -as [int]) -or $sel -lt 1 -or $sel -gt $candidates.Count) {
  Err "Selección inválida."; exit 1
}
$chosen = $candidates[$sel-1]
Ok "Elegida: $chosen"

# === Modificar render.yaml sin regex complejas ===
$renderPath = Join-Path (Get-Location) "render.yaml"
if (!(Test-Path $renderPath)) { Err "No existe render.yaml aquí."; exit 1 }

# Leer como líneas
$lines = Get-Content $renderPath -ErrorAction Stop

# Quitar bloque previo de PRODUCTS_TABLE (línea 'key: PRODUCTS_TABLE' y su 'value:' siguiente)
$clean = @()
$skipNext = $false
foreach ($ln in $lines) {
  if ($skipNext) { $skipNext = $false; continue }
  if ($ln -match "key:\s*PRODUCTS_TABLE") {
    $skipNext = $true  # asumimos formato de 2 líneas 'key' y 'value'
    continue
  }
  $clean += $ln
}

# Encontrar posición de 'envVars:' (primera que aparezca)
$envIndex = -1
for ($i=0; $i -lt $clean.Count; $i++) {
  if ($clean[$i] -match "^\s*envVars:\s*$") { $envIndex = $i; break }
}

# Bloque a insertar (respeta indent 6 espacios bajo envVars:)
$block = @(
"      - key: PRODUCTS_TABLE",
"        value: `"$chosen`""
)

if ($envIndex -ge 0) {
  # Insertar después de envVars:
  $before = $clean[0..$envIndex]
  $after  = @()
  if ($envIndex + 1 -lt $clean.Count) { $after = $clean[($envIndex+1)..($clean.Count-1)] }
  $newLines = @()
  $newLines += $before
  $newLines += $block
  $newLines += $after
  Set-Content -Path $renderPath -Value $newLines -Encoding UTF8
} else {
  # No existe envVars: -> agregar al final un bloque mínimo
  $append = @()
  $append += ""
  $append += "    envVars:"
  $append += $block
  $newLines = $clean + $append
  Set-Content -Path $renderPath -Value $newLines -Encoding UTF8
}

Ok "render.yaml actualizado con PRODUCTS_TABLE = $chosen"

# === Commit + push (redeploy) ===
git add render.yaml
git commit -m "chore: set PRODUCTS_TABLE = $chosen"
git push
Ok "Cambios empujados. Render hará auto-redeploy."

# === Probar /products cuando quede live ===
Write-Host "`nEsperando que quede Live para probar /products ..." -ForegroundColor Yellow
$ok = $false
for ($i=1; $i -le 30; $i++) {
  try {
    $h = Invoke-WebRequest "$API_BASE/health" -UseBasicParsing -TimeoutSec 10
    if ($h.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Seconds 5
}
if ($ok) {
  try {
    $p = Invoke-WebRequest "$API_BASE/products" -UseBasicParsing -TimeoutSec 30
    if ($p.StatusCode -eq 200) {
      Ok "/products OK → JSON recibido"
    } else {
      Warn "/products → $($p.StatusCode)"
      Write-Host $p.Content
    }
  } catch {
    Err "Error llamando /products: $($_.Exception.Message)"
  }
} else {
  Warn "No confirmé /health en el tiempo previsto. Mira los Events/Logs en Render."
}
