# 05c-portable-git-and-push.ps1
# Descarga y usa PortableGit (64-bit) sin instalar, agrega su bin a PATH en esta sesión y luego ejecuta 06-push-to-github.ps1.

$ErrorActionPreference = "Stop"
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 1) Detectar carpeta de trabajo y preparar rutas
$Root = Get-Location
$ToolsDir = Join-Path $Root ".tools"
if (!(Test-Path $ToolsDir)) { New-Item -ItemType Directory -Path $ToolsDir | Out-Null }

$PortableGitDir = Join-Path $ToolsDir "PortableGit"
$PortableGitBin = Join-Path $PortableGitDir "bin"
$Downloader = $null

# 2) Determinar cómo descargar (BITS si está; si no, Invoke-WebRequest)
if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
  $Downloader = "BITS"
} else {
  $Downloader = "IWR"
}

# 3) Si no está Git portátil, descargar y extraer
$NeedDownload = $true
if (Test-Path (Join-Path $PortableGitBin "git.exe")) {
  $NeedDownload = $false
  Ok "PortableGit ya existe: $PortableGitBin"
}

if ($NeedDownload) {
  Info "Descargando PortableGit (64-bit)..."
  # URL 'latest' de Git for Windows portable (SFX .7z.exe)
  $Url = "https://github.com/git-for-windows/git/releases/latest/download/PortableGit-64-bit.7z.exe"
  $Tmp = Join-Path $ToolsDir "PortableGit-64-bit.7z.exe"

  try {
    if ($Downloader -eq "BITS") {
      Start-BitsTransfer -Source $Url -Destination $Tmp
    } else {
      Invoke-WebRequest -Uri $Url -OutFile $Tmp -UseBasicParsing
    }
  } catch {
    Err "No se pudo descargar PortableGit. Revisa tu conexión a Internet o proxy."
    throw
  }

  # 4) Extraer en $PortableGitDir (el SFX autoextraíble acepta -y y -o)
  Info "Extrayendo PortableGit en $PortableGitDir ..."
  if (!(Test-Path $PortableGitDir)) { New-Item -ItemType Directory -Path $PortableGitDir | Out-Null }

  # Los SFX de 7-Zip aceptan: -y para yes to all, -o<dir> para output
  $args = "-y -o$PortableGitDir"
  $proc = Start-Process -FilePath $Tmp -ArgumentList $args -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    Err "Fallo al extraer PortableGit (código $($proc.ExitCode))."
    throw "Extracción fallida"
  }

  # Limpieza
  try { Remove-Item $Tmp -Force | Out-Null } catch {}
}

# 5) Añadir PortableGit/bin al PATH de la sesión
if (Test-Path $PortableGitBin) {
  $env:Path = "$PortableGitBin;$env:Path"
  Ok "PATH actualizado temporalmente con: $PortableGitBin"
} else {
  Err "No se encontró carpeta bin de PortableGit. Revisa permisos en: $PortableGitDir"
  exit 1
}

# 6) Verificar git
try {
  $gitV = & git --version
  Ok "Git OK: $gitV"
} catch {
  Err "git no responde incluso con PortableGit en PATH. Abre una nueva consola y vuelve a ejecutar este script."
  exit 1
}

# 7) Ejecutar 06-push-to-github.ps1 (debe estar en la misma carpeta)
$PushScript = Join-Path $Root "06-push-to-github.ps1"
if (!(Test-Path $PushScript)) {
  Err "No encuentro 06-push-to-github.ps1 en: $PushScript"
  Write-Host "Guarda este script en la misma carpeta donde está 06-push-to-github.ps1 y vuelve a correr." -ForegroundColor Yellow
  exit 1
}

try { Unblock-File $PushScript } catch {}
Info "Ejecutando 06-push-to-github.ps1 ..."
powershell -ExecutionPolicy Bypass -File $PushScript
