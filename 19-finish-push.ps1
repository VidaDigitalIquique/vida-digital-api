# 19-finish-push.ps1
$ErrorActionPreference = "Stop"

$REMOTE = "https://github.com/VidaDigitaliquique/vida-digital-api.git"
$BRANCH = "main"
$COMMIT_MSG = "deploy(api): entrypoint + /db/diag + /products (sanjh/vida)"

# Asegurar repo y rama
if (-not (Test-Path ".git")) { throw "No hay repo git aquí. Vuelve a correr 18-deploy-render-vida.ps1" }
$cur = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cur -ne $BRANCH) { git checkout $BRANCH | Out-Null }

# Remoto origin -> URL correcta
$hasOrigin = $false
try { $rem = (git remote) -split "\r?\n"; $hasOrigin = ($rem -contains "origin") } catch {}
if ($hasOrigin) {
  $url = (git remote get-url origin).Trim()
  if ($url -ne $REMOTE) { git remote set-url origin $REMOTE }
} else {
  git remote add origin $REMOTE
}

# Commit (si hay cambios)
git add -A
try { git commit -m $COMMIT_MSG | Out-Null } catch { Write-Host "Nada nuevo para commit (ok)." }

# Intentar alinear con remoto si existe
$pulled = $true
try { git fetch origin $BRANCH; git pull --rebase origin $BRANCH } catch { $pulled = $false; Write-Host "Repo remoto vacío o privado (continuo sin pull)." }

# Push con upstream
try {
  git push -u origin $BRANCH
  Write-Host "`n✅ Push OK a $REMOTE ($BRANCH)."
} catch {
  Write-Warning "El push falló. Si quieres sobrescribir el remoto con tu estado local:"
  Write-Host "  git push -u origin $BRANCH --force-with-lease"
  throw
}

Write-Host "`nSiguiente en Render:"
Write-Host "  • Settings → Start command: node src/index.cjs"
Write-Host "  • Environment → DATABASE_URL (Neon con sslmode=require&channel_binding=require)"
Write-Host "  • Manual Deploy → Clear build cache & Deploy"
Write-Host "`nLuego prueba:"
Write-Host '  Invoke-WebRequest https://vida-digital-api.onrender.com/health | Select-Object StatusCode,Content'
Write-Host '  Invoke-WebRequest https://vida-digital-api.onrender.com/db/diag  | Select-Object StatusCode,Content'
Write-Host '  Invoke-WebRequest "https://vida-digital-api.onrender.com/products?limit=20" | Select-Object StatusCode,Content'
