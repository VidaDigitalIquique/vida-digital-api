# 07b-wait-for-health.ps1
param(
  [Parameter(Mandatory=$true)]
  [string]$BaseUrl,            # ej: https://vida-digital-api.onrender.com
  [int]$MaxTries = 60,         # 60 intentos x 10s ≈ 10 minutos
  [int]$SleepSeconds = 10
)

$ErrorActionPreference = "SilentlyContinue"
function Stamp($m){ Write-Host "[$(Get-Date -Format HH:mm:ss)] $m" }

for ($i=1; $i -le $MaxTries; $i++) {
  try {
    $r = Invoke-WebRequest "$BaseUrl/health" -UseBasicParsing -TimeoutSec 25
    if ($r.StatusCode -eq 200) {
      Stamp "/health OK → $($r.Content)"
      exit 0
    } else {
      Stamp "Intento $i/$MaxTries → status $($r.StatusCode)"
    }
  } catch {
    Stamp "Intento $i/$MaxTries → aún no responde ($($_.Exception.Message))"
  }
  Start-Sleep -Seconds $SleepSeconds
}
Write-Host "No llegó a OK en el tiempo dado." -ForegroundColor Yellow
exit 1
