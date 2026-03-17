# 05b-install-git-direct-and-push.ps1
# Descarga e instala Git para Windows (64-bit) en silencio y luego ejecuta 06-push-to-github.ps1

$ErrorActionPreference = "Stop"
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 0) Elevar privilegios si no es admin
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$IsAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
  Warn "Reiniciando PowerShell en modo Administrador para instalar Git..."
  $psi = New-Object System.Diagnostics.ProcessStartInfo "powershell";
  $psi.Arguments = "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $psi.Verb = "runas"
  [System.Diagnostics.Process]::Start($psi) | Out-Null
  exit 0
}

# 1) Si ya hay git, saltar a ejecutar 06-
$gitOk = $false
try { git --version | Out-Null; $gitOk = $true } catch {}
if ($gitOk) {
  Ok "Git ya está instalado."
  goto RUN_PUSH
}

# 2) Descargar instalador oficial (última versión 64-bit)
$downloadUrl = "https://github.com/git-for-windows/git/releases/latest/download/Git-64-bit.exe"
$tempDir = New-Item -ItemType Directory -Path ([System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "git-install")) -Force
$installer = Join-Path $tempDir "Git-64-bit.exe"

Info "Descargando Git desde: $downloadUrl"
try {
  # Preferir BITS si está disponible (mejor con cortes)
  if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
    Start-BitsTransfer -Source $downloadUrl -Destination $installer
  } else {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installer -UseBasicParsing
  }
} catch {
  Err "No se pudo descargar el instalador de Git. Verifica tu conexión o firewall."
  throw
}

# 3) Instalar en silencio (Inno Setup flags)
Info "Instalando Git en silencio..."
$arguments = "/VERYSILENT /NORESTART /SP-"
$proc = Start-Process -FilePath $installer -ArgumentList $arguments -PassThru -Wait
if ($proc.ExitCode -ne 0) {
  Err "La instalación de Git devolvió código $($proc.ExitCode)."
  throw "Fallo instalación Git"
}

# 4) Refrescar PATH en esta sesión
try {
  $machinePath = [System.Environment]::GetEnvironmentVariable('Path','Machine')
  $userPath = [System.Environment]::GetEnvironmentVariable('Path','User')
  $env:Path = "$machinePath;$userPath"
} catch {
  Warn "No se pudo refrescar PATH automáticamente. Si 'git' no se reconoce, abre una nueva consola Admin."
}

# 5) Verificar git
try {
  $gitV = git --version
  Ok "Git instalado correctamente: $gitV"
} catch {
  Err "Tras instalar, 'git' no se reconoce en esta sesión. Cierra y abre PowerShell (Administrador) y vuelve a ejecutar este script."
  exit 1
}

# 6) Limpiar temporal
try { Remove-Item $tempDir -Recurse -Force | Out-Null } catch {}

:RUN_PUSH
# 7) Ejecutar 06-push-to-github.ps1 (debe estar en la misma carpeta)
$deployScript = Join-Path (Get-Location) "06-push-to-github.ps1"
if (!(Test-Path $deployScript)) {
  Err "No encuentro 06-push-to-github.ps1 en: $deployScript"
  Write-Host "Guarda este script en la misma carpeta donde está 06-push-to-github.ps1 y vuelve a correr." -ForegroundColor Yellow
  exit 1
}

try { Unblock-File $deployScript } catch {}
Info "Ejecutando 06-push-to-github.ps1 ..."
powershell -ExecutionPolicy Bypass -File $deployScript
