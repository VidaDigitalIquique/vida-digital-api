# 07-test-api.ps1
# Prueba endpoints de tu API en Render
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Err($m){ Write-Host $m -ForegroundColor Red }

$Base = Read-Host "Pega la URL pública de Render (ej: https://vida-digital-api.onrender.com)"
if ([string]::IsNullOrWhiteSpace($Base)) { Err "URL vacía"; exit 1 }

try {
  $h = Invoke-WebRequest "$Base/health" -UseBasicParsing -TimeoutSec 30
  if ($h.StatusCode -eq 200) { Ok "/health OK → $($h.Content)" } else { Err "/health → $($h.StatusCode)" }
} catch { Err "Error /health: $($_.Exception.Message)" }

try {
  $p = Invoke-WebRequest "$Base/products" -UseBasicParsing -TimeoutSec 60
  if ($p.StatusCode -eq 200) { Ok "/products OK (JSON recibido)" } else { Err "/products → $($p.StatusCode)" }
} catch { Err "Error /products: $($_.Exception.Message)" }

try {
  $c = Invoke-WebRequest "$Base/products/export.csv" -UseBasicParsing -TimeoutSec 60
  if ($c.StatusCode -eq 200) { Ok "/products/export.csv OK (CSV recibido)" } else { Err "/products/export.csv → $($c.StatusCode)" }
} catch { Err "Error /products/export.csv: $($_.Exception.Message)" }
