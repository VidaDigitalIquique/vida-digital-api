# 05a-choco-git-and-deploy.ps1
# Instala Chocolatey, luego Git (y opcionalmente GitHub CLI), refresca PATH y corre 04-deploy-render.ps1

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 0) Elevar privilegios si no es admin (Chocolatey lo requiere)
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$IsAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
  Warn "Esta consola no está en modo Administrador. Chocolatey requiere admin."
  $resp = Read-Host "¿Reiniciar esta ventana en modo Administrador y continuar? (s/n)"
  if ($resp -match '^[sS]') {
    # relanza como admin
    $psi = New-Object System.Diagnostics.ProcessStartInfo "powershell";
    $psi.Arguments = "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
    $psi.Verb = "runas"
    [System.Diagnostics.Process]::Start($psi) | Out-Null
    exit 0
  } else {
    Err "Debes ejecutar este script como Administrador para instalar Chocolatey."
    exit 1
  }
}

# 1) Instalar Chocolatey si falta
try {
  choco -v | Out-Null
  Ok "Chocolatey ya está instalado."
} catch {
  Info "Instalando Chocolatey..."
  Set-ExecutionPolicy Bypass -Scope Process -Force
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
  Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
  Ok "Chocolatey instalado."
}

# 2) Instalar Git
$gitOk = $false
try { git --version | Out-Null; $gitOk = $true } catch {}
if (-not $gitOk) {
  Info "Instalando Git con Chocolatey..."
  choco install git -y --no-progress
} else {
  Ok "Git ya está instalado."
}

# 3) (Opcional) Instalar GitHub CLI
$ghFound = $false
try { gh --version | Out-Null; $ghFound = $true } catch {}
if (-not $ghFound) {
  Warn "GitHub CLI (gh) no está instalado. Facilita crear/subir el repo automáticamente."
  $answer = Read-Host "¿Instalar gh ahora? (s/n)"
  if ($answer -match '^[sS]') {
    Info "Instalando gh con Chocolatey..."
    choco install gh -y --no-progress
  } else {
    Warn "Saltaré la instalación de gh. Podrás agregar remoto y hacer push manualmente."
  }
} else {
  Ok "GitHub CLI ya está instalado."
}

# 4) Refrescar PATH en esta sesión
try {
  $machinePath = [System.Environment]::GetEnvironmentVariable('Path','Machine')
  $userPath = [System.Environment]::GetEnvironmentVariable('Path','User')
  $env:Path = "$machinePath;$userPath"
  Ok "PATH refrescado en la sesión actual."
} catch {
  Warn "No se pudo refrescar PATH; si 'git' no se reconoce, abre una nueva consola y vuelve a ejecutar."
}

# 5) Verificar Git
try {
  $gitV = git --version
  Ok "Git OK: $gitV"
} catch {
  Err "Tras instalar, 'git' sigue sin estar disponible. Cierra y abre PowerShell (Admin) y re-ejecuta este script."
  exit 1
}

# 6) Ejecutar 04-deploy-render.ps1 (debe estar en la misma carpeta)
$deployScript = Join-Path (Get-Location) "04-deploy-render.ps1"
if (!(Test-Path $deployScript)) {
  Err "No encuentro 04-deploy-render.ps1 en: $deployScript"
  Write-Host "Guarda este script en la misma carpeta donde está 04-deploy-render.ps1 y vuelve a correr." -ForegroundColor Yellow
  exit 1
}

try { Unblock-File $deployScript } catch {}
Info "Ejecutando 04-deploy-render.ps1 ..."
powershell -ExecutionPolicy Bypass -File $deployScript
