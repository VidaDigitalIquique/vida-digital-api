# 06d-set-git-identity.ps1
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# Mostrar config actual
Info "Config git actual (global):"
try { git config --global --get user.name  | %{ "  user.name = $_" } } catch {}
try { git config --global --get user.email | %{ "  user.email = $_" } } catch {}

# Pedir valores si faltan o si quieres cambiarlos
$set = Read-Host "¿Quieres configurar/actualizar identidad global ahora? (s/n)"
if ($set -notmatch '^[sS]') { Ok "Listo. No se cambió nada."; exit 0 }

# Sugerencias: puedes poner tu nombre real o alias
$defName  = "VidaDigitalIquique"
$defEmail = "vidadigitaliquique@users.noreply.github.com"

$name  = Read-Host "Nombre a usar en los commits (ej. $defName)"
if ([string]::IsNullOrWhiteSpace($name)) { $name = $defName }

$email = Read-Host "Email a usar en los commits (ej. $defEmail)"
if ([string]::IsNullOrWhiteSpace($email)) { $email = $defEmail }

git config --global user.name  "$name"
git config --global user.email "$email"

Ok "Identidad global configurada:"
git config --global --get user.name  | %{ "  user.name = $_" }
git config --global --get user.email | %{ "  user.email = $_" }
