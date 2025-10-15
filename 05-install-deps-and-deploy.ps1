# 05-install-deps-and-deploy.ps1
# Instala Git (y opcionalmente gh), refresca PATH y ejecuta 04-deploy-render.ps1.
$ErrorActionPreference = "Stop"

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 0) Verifica winget
try {
  $wingetV = winget --version 2>$null
  if (-not $wingetV) { throw "winget not available" }
  Info "winget: $wingetV"
} catch {
  Err "No encontré 'winget'. En Windows 10/11 normalmente viene con la Microsoft Store (App Installer). Abre Microsoft Store y actualiza 'App Installer', luego vuelve a correr este script."
  exit 1
}

# 1) Instalar Git si falta
$gitOk = $false
try { git --version | Out-Null; $gitOk = $true } catch {}
if (-not $gitOk) {
  Info "Instalando Git con winget..."
  winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
  Start-Sleep -Seconds 3
} else {
  Ok "Git ya está instalado."
}

# 2) Instalar GitHub CLI (opcional)
$ghFound = $false
try { gh --version | Out-Null; $ghFound = $true } catch {}
if (-not $ghFound) {
  Warn "GitHub CLI (gh) no está instalado. Es opcional, pero facilita crear/pushear el repo automáticamente."
  $answer = Read-Host "¿Instalar gh ahora? (s/n)"
  if ($answer -match '^[sS]') {
    Info "Instalando GitHub CLI (gh) con winget..."
    winget install --id GitHub.cli -e --source winget --silent --accept-package-agreements --accept-source-agreements
    Start-Sleep -Seconds 3
  } else {
    Warn "Saltaré la instalación de gh. Podrás agregar el remoto y pushear manualmente."
  }
} else {
  Ok "GitHub CLI ya está instalado."
}

# 3) Refrescar PATH en la sesión actual (sin reiniciar)
try {
  $machinePath = [System.Environment]::GetEnvironmentVariable('Path','Machine')
  $userPath = [System.Environment]::GetEnvironmentVariable('Path','User')
  $env:Path = "$machinePath;$userPath"
  Ok "PATH refrescado en la sesión actual."
} catch {
  Warn "No se pudo refrescar PATH; si 'git' no se reconoce, abre una nueva consola y vuelve a ejecutar."
}

# 4) Verificar git ahora
try {
  $gitV = git --version
  Ok "Git OK: $gitV"
} catch {
  Err "Tras instalar, 'git' sigue sin estar disponible en esta sesión. Cierra y vuelve a abrir PowerShell, y ejecuta de nuevo este script."
  exit 1
}

# 5) Ejecutar 04-deploy-render.ps1
#    (debe estar en la MISMA carpeta que este script)
$deployScript = Join-Path (Get-Location) "04-deploy-render.ps1"
if (!(Test-Path $deployScript)) {
  Err "No encuentro 04-deploy-render.ps1 en la carpeta actual: $deployScript"
  Write-Host "Asegúrate de guardar este script junto a 04-deploy-render.ps1 y vuelve a correr." -ForegroundColor Yellow
  exit 1
}

# Desbloquear y ejecutar
try {
  Unblock-File $deployScript
} catch {}
Info "Ejecutando 04-deploy-render.ps1 ..."
powershell -ExecutionPolicy Bypass -File $deployScript
