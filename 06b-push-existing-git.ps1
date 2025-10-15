# 06b-push-existing-git.ps1
# Publica la carpeta 'vida-digital-api' en GitHub usando Git ya instalado (sin gh).
$ErrorActionPreference = "Stop"

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 0) Verificar git en PATH
try { $gitV = git --version; Ok "Git OK: $gitV" } catch { Err "No encuentro 'git' en PATH. Abre una NUEVA ventana de PowerShell y vuelve a correr este script."; exit 1 }

# 1) Ir a la carpeta del proyecto
$Root = Get-Location
$ProjectName = "vida-digital-api"
$ProjectPath = Join-Path $Root $ProjectName
if (!(Test-Path $ProjectPath)) {
  Err "No encontré la carpeta '$ProjectName' en: $ProjectPath"
  Write-Host "Ejecuta primero el script 04 (deploy Render) o coloca aquí tu backend y vuelve a correr." -ForegroundColor Yellow
  exit 1
}
Set-Location $ProjectPath

# 2) Configurar user.name/email si faltan
$needUser = $false
try {
  $uname = git config --get user.name
  $uemail = git config --get user.email
  if (-not $uname -or -not $uemail) { $needUser = $true }
} catch { $needUser = $true }

if ($needUser) {
  Warn "Falta configurar git user.name y/o user.email."
  $name  = Read-Host "Nombre (p.ej. Pablo Bravo)"
  $email = Read-Host "Email (p.ej. tu-email@dominio.com)"
  if (-not $name -or -not $email) { Err "Se requieren nombre y email para continuar."; exit 1 }
  git config user.name  "$name"
  git config user.email "$email"
  Ok "git config listo."
}

# 3) Inicializar repo si no existe
if (!(Test-Path ".git")) {
  Info "Inicializando repo git..."
  git init | Out-Null
}

# 4) Commit (si faltan commits o hay cambios)
$hasCommits = $true
try { git rev-parse --verify HEAD | Out-Null } catch { $hasCommits = $false }
git add . | Out-Null
if (-not $hasCommits) {
  git commit -m "chore: initial Render blueprint setup" | Out-Null
  Ok "Commit inicial creado."
} else {
  # si hay cambios staged, comitea; si no, sigue
  try {
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
      git commit -m "chore: update before publish" | Out-Null
      Ok "Cambios comiteados."
    } else {
      Warn "Sin cambios pendientes."
    }
  } catch {}
}

# 5) Configurar remoto y hacer push
function HasRemote {
  try {
    $remotes = git remote
    return ($remotes -ne $null -and $remotes.Trim().Length -gt 0)
  } catch { return $false }
}

if (-not (HasRemote)) {
  Write-Host "`nCrea un repo VACÍO en GitHub: https://github.com/new" -ForegroundColor Yellow
  Write-Host " - Repository name: vida-digital-api" -ForegroundColor Yellow
  Write-Host " - SIN README/.gitignore/license (debe estar vacío)" -ForegroundColor Yellow
  $remote = Read-Host "Pega la URL HTTPS del repo (ej: https://github.com/<usuario>/vida-digital-api.git)"
  if (-not $remote) { Err "URL remota no ingresada. Cancelo."; exit 1 }
  git remote add origin $remote
}

git branch -M main
git push -u origin main
Ok "Código pusheado a GitHub."

# 6) Mensaje final: Render
$repoUrl = ""
try { $repoUrl = git remote get-url origin } catch {}
Ok "`nSiguiente paso:"
Write-Host "1) Ve a https://dashboard.render.com → New → Blueprint" -ForegroundColor Green
if ($repoUrl) { Write-Host "   Elige el repo: $repoUrl" -ForegroundColor Green }
Write-Host "2) Render leerá 'render.yaml' y hará el deploy (plan free)." -ForegroundColor Green
Write-Host "3) Usa la URL pública HTTPS como API_BASE en tu frontend de AI Studio." -ForegroundColor Green
