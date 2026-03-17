# 06-push-to-github.ps1
# Publica la carpeta 'vida-digital-api' en GitHub (crea repo con gh o usa un remoto que ingreses).
$ErrorActionPreference = "Stop"

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# === Config ===
$ProjectName    = "vida-digital-api"   # carpeta local creada por el script 04
$GitHubRepoName = "vida-digital-api"   # nombre del repo nuevo en tu cuenta GitHub

# 1) Chequeos básicos
try { git --version | Out-Null } catch { Err "No encuentro 'git'. Instálalo y vuelve a correr."; exit 1 }

# 2) Ir a la carpeta del proyecto
$Root = Get-Location
$ProjectPath = Join-Path $Root $ProjectName
if (!(Test-Path $ProjectPath)) {
  Err "No encontré la carpeta '$ProjectName' en: $ProjectPath"
  Write-Host "Primero ejecuta el script 04 (o crea la carpeta) y vuelve a correr." -ForegroundColor Yellow
  exit 1
}
Set-Location $ProjectPath

# 3) Config git user si falta (mínimo viable)
$needUser = $false
try {
  $uname = git config --get user.name
  if (-not $uname) { $needUser = $true }
  $uemail = git config --get user.email
  if (-not $uemail) { $needUser = $true }
} catch { $needUser = $true }

if ($needUser) {
  Warn "Config git user.name y user.email no encontrados."
  $name  = Read-Host "Ingresa tu nombre para git (p.ej. Pablo Bravo)"
  $email = Read-Host "Ingresa tu email para git (p.ej. tu-email@dominio.com)"
  if (-not $name -or -not $email) { Err "Se requieren nombre y email para continuar."; exit 1 }
  git config user.name  "$name"
  git config user.email "$email"
  Ok "Configurado git user.name y user.email."
}

# 4) Inicializar repo local si no existe
if (!(Test-Path ".git")) {
  Info "Inicializando repo git local..."
  git init | Out-Null
}

# 5) Commit inicial si no hay commits
$hasCommits = $true
try { git rev-parse --verify HEAD | Out-Null } catch { $hasCommits = $false }
if (-not $hasCommits) {
  git add . | Out-Null
  git commit -m "chore: initial Render blueprint setup" | Out-Null
  Ok "Commit inicial creado."
} else {
  # Asegura que todo esté agregado
  git add . | Out-Null
  # Commit vacío si no hay cambios; si hay, hace commit normal
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

# 6) ¿Tenemos remoto?
function HasRemote {
  try {
    $remotes = git remote
    return ($remotes -ne $null -and $remotes.Trim().Length -gt 0)
  } catch { return $false }
}

# 7) Si hay gh CLI, usarlo para crear repo y pushear
$usingGh = $false
if (-not (HasRemote)) {
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    Info "Usando GitHub CLI para crear repo '$GitHubRepoName' (privado) y pushear..."
    # Verificar auth; si falla, lanzar login web
    try {
      gh auth status 2>$null | Out-Null
    } catch {
      Warn "No estás autenticado en gh. Abriendo login..."
      gh auth login -w
    }
    # Crear repo y push
    gh repo create $GitHubRepoName --private --source "." --remote origin --push --description "Vida Digital API (Render blueprint)" | Out-Null
    $usingGh = $true
    Ok "Repo creado y código pusheado con gh."
  }
}

# 8) Si no hay gh o falló, pedir URL remota y hacer push
if (-not $usingGh) {
  if (-not (HasRemote)) {
    Warn "No se encontró remoto configurado y no se utilizó gh."
    Write-Host "1) Crea un repo VACÍO en GitHub (privado o público): https://github.com/new" -ForegroundColor Yellow
    Write-Host "   - Repository name: $GitHubRepoName" -ForegroundColor Yellow
    Write-Host "   - NO agregues README/.gitignore/license (para que esté vacío)" -ForegroundColor Yellow
    $remote = Read-Host "Pega aquí la URL HTTPS del repo vacío (ej: https://github.com/<usuario>/$GitHubRepoName.git)"
    if (-not $remote) { Err "URL remota no ingresada. Cancelo."; exit 1 }
    git remote add origin $remote
    git branch -M main
    git push -u origin main
    Ok "Código pusheado a $remote"
  } else {
    Info "Remoto ya existe. Haciendo push..."
    git branch -M main
    git push -u origin main
    Ok "Código actualizado en el remoto existente."
  }
}

# 9) Mostrar siguiente paso en Render
$repoUrl = ""
try {
  $repoUrl = git remote get-url origin
} catch {}
Ok "`nListo. Siguiente:"
Write-Host "1) Ve a https://dashboard.render.com → New → Blueprint" -ForegroundColor Green
if ($repoUrl) {
  Write-Host "   Selecciona el repo: $repoUrl" -ForegroundColor Green
} else {
  Write-Host "   Selecciona el repo que acabas de crear en GitHub." -ForegroundColor Green
}
Write-Host "2) Render leerá render.yaml y hará el deploy (plan free)." -ForegroundColor Green
Write-Host "3) Copia la URL pública HTTPS y úsala como API_BASE en tu frontend de AI Studio." -ForegroundColor Green
