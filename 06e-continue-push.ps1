# 06e-continue-push.ps1
# Continúa el proceso de publicar 'vida-digital-api' en GitHub usando Git ya instalado.
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

try { git --version | Out-Null } catch { Err "No encuentro 'git' en PATH. Abre una NUEVA PowerShell e intenta de nuevo."; exit 1 }

# Ir a la carpeta del proyecto
$Root = Get-Location
$Project = "vida-digital-api"
$Path = Join-Path $Root $Project
if (!(Test-Path $Path)) { Err "No existe la carpeta '$Project' aquí. Muévete a donde está esa carpeta."; exit 1 }
Set-Location $Path

# Asegurar identidad (global ya configurada)
try {
  $u1 = git config --get user.name
  $u2 = git config --get user.email
  if (-not $u1 -or -not $u2) { Err "user.name/email no configurados. Corre primero 06d-set-git-identity.ps1"; exit 1 }
} catch { Err "No pude leer la configuración de git. Corre 06d-set-git-identity.ps1"; exit 1 }

# Repo local + commit
if (!(Test-Path ".git")) { git init | Out-Null }
git add . | Out-Null
try { git rev-parse --verify HEAD | Out-Null; $hasCommit=$true } catch { $hasCommit=$false }
if (-not $hasCommit) { git commit -m "chore: initial Render blueprint setup" | Out-Null } else {
  git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { git commit -m "chore: update before publish" | Out-Null }
}

# Remoto
function HasRemote {
  try { $r = git remote; return ($r -ne $null -and $r.Trim().Length -gt 0) } catch { return $false }
}
if (-not (HasRemote)) {
  Write-Host "`nCrea un repo VACÍO en GitHub: https://github.com/new" -ForegroundColor Yellow
  Write-Host " - Repository name: vida-digital-api" -ForegroundColor Yellow
  Write-Host " - SIN README/.gitignore/license" -ForegroundColor Yellow
  $remote = Read-Host "Pega la URL HTTPS del repo (ej: https://github.com/<usuario>/vida-digital-api.git)"
  if ([string]::IsNullOrWhiteSpace($remote)) { Err "URL remota no ingresada. Cancelo."; exit 1 }
  git remote add origin $remote
}

git branch -M main
git push -u origin main
Ok "Código pusheado a GitHub. Ahora ve a Render → New → Blueprint y elige ese repo."
