# 05d-resilient-portable-git-and-push.ps1
# Descarga PortableGit (3 métodos: curl.exe -> Invoke-WebRequest -> BITS), extrae y ejecuta 06-push-to-github.ps1.
$ErrorActionPreference = "Stop"
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

$Root = Get-Location
$ToolsDir = Join-Path $Root ".tools"
if (!(Test-Path $ToolsDir)) { New-Item -ItemType Directory -Path $ToolsDir | Out-Null }

$PortableGitDir = Join-Path $ToolsDir "PortableGit"
$PortableGitBin = Join-Path $PortableGitDir "bin"

# URL oficial (última versión PortableGit 64-bit self-extract)
$Url = "https://github.com/git-for-windows/git/releases/latest/download/PortableGit-64-bit.7z.exe"
$Tmp = Join-Path $ToolsDir "PortableGit-64-bit.7z.exe"

# ====== 0) Si ya existe PortableGit/bin, saltamos descarga ======
if (Test-Path (Join-Path $PortableGitBin "git.exe")) {
  Ok "PortableGit ya presente en: $PortableGitBin"
  goto AFTER_EXTRACT
}

# ====== 1) Intentar descarga si el archivo no existe ======
if (!(Test-Path $Tmp)) {
  Info "Descargando PortableGit (64-bit) ..."
  $downloaded = $false

  # Método A: curl.exe (suele saltarse bloqueos donde BITS/IWR fallan)
  try {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
      Info "Intentando con curl.exe ..."
      & $curl.Source "--location" "--fail" "--output" "$Tmp" "$Url"
      if (Test-Path $Tmp) { $downloaded = $true; Ok "Descarga con curl.exe OK" }
    }
  } catch { Warn "curl.exe falló: $($_.Exception.Message)" }

  # Método B: Invoke-WebRequest con TLS 1.2
  if (-not $downloaded) {
    try {
      Info "Intentando con Invoke-WebRequest ..."
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri $Url -OutFile $Tmp -UseBasicParsing -TimeoutSec 120
      if (Test-Path $Tmp) { $downloaded = $true; Ok "Descarga con Invoke-WebRequest OK" }
    } catch { Warn "Invoke-WebRequest falló: $($_.Exception.Message)" }
  }

  # Método C: BITS (puede fallar con políticas corporativas)
  if (-not $downloaded) {
    try {
      if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
        Info "Intentando con BITS (Start-BitsTransfer) ..."
        Start-BitsTransfer -Source $Url -Destination $Tmp
        if (Test-Path $Tmp) { $downloaded = $true; Ok "Descarga con BITS OK" }
      }
    } catch { Warn "BITS falló: $($_.Exception.Message)" }
  }

  # Fallback manual
  if (-not $downloaded) {
    Err "No se pudo descargar automáticamente PortableGit."
    Write-Host "DESCARGA MANUAL: abre esta URL en tu navegador y guarda el archivo como:" -ForegroundColor Yellow
    Write-Host "  $Url" -ForegroundColor Yellow
    Write-Host "Guárdalo en:" -ForegroundColor Yellow
    Write-Host "  $Tmp" -ForegroundColor Yellow
    Read-Host "Presiona Enter cuando hayas colocado el archivo en esa ruta"
    if (!(Test-Path $Tmp)) {
      Err "No se encuentra el archivo en $Tmp. No puedo continuar."
      exit 1
    }
  }
} else {
  Warn "Archivo ya descargado: $Tmp"
}

# ====== 2) Extraer a PortableGitDir ======
if (!(Test-Path $PortableGitDir)) { New-Item -ItemType Directory -Path $PortableGitDir | Out-Null }
Info "Extrayendo PortableGit en: $PortableGitDir ..."
# El SFX (7z) acepta: -y (yes to all) y -o<dir>
$args = "-y -o$PortableGitDir"
$proc = Start-Process -FilePath $Tmp -ArgumentList $args -Wait -PassThru
if ($proc.ExitCode -ne 0) {
  Err "Fallo al extraer PortableGit (código $($proc.ExitCode))."
  exit 1
}

# Limpieza del instalador descargado (opcional)
try { Remove-Item $Tmp -Force | Out-Null } catch {}

:AFTER_EXTRACT
# ====== 3) Inyectar PortableGit/bin en PATH de la sesión ======
if (Test-Path $PortableGitBin) {
  $env:Path = "$PortableGitBin;$env:Path"
  Ok "PATH actualizado temporalmente con: $PortableGitBin"
} else {
  Err "No se encontró carpeta bin de PortableGit. Revisa: $PortableGitDir"
  exit 1
}

# ====== 4) Verificar git ======
try {
  $gitV = & git --version
  Ok "Git OK: $gitV"
} catch {
  Err "git no responde, incluso con PortableGit en PATH."
  exit 1
}

# ====== 5) Ejecutar 06-push-to-github.ps1 ======
$PushScript = Join-Path $Root "06-push-to-github.ps1"
if (!(Test-Path $PushScript)) {
  Err "No encuentro 06-push-to-github.ps1 en: $PushScript"
  Write-Host "Guárdalo en la misma carpeta y vuelve a ejecutar este script." -ForegroundColor Yellow
  exit 1
}

try { Unblock-File $PushScript } catch {}
Info "Ejecutando 06-push-to-github.ps1 ..."
powershell -ExecutionPolicy Bypass -File $PushScript
