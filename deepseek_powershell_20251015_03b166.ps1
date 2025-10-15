# 16-deploy-render.ps1
$ErrorActionPreference = "Stop"

# Verificar si es un repositorio git antes de ejecutar comandos git
if (-not (Test-Path ".git")) {
    Write-Host "Error: No es un repositorio git. Ejecuta 'git init' primero."
    exit 1
}

git status
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Rama actual: $branch"

git add -A
try {
    git commit -m "deploy(api): /products prioriza sanjh/vida + /db/diag + entrypoint estable"
} catch {
    Write-Host "Nada que commitear (posible). Continuo con push..."
}
git push origin $branch

Write-Host ""
Write-Host "Ahora en Render:"
Write-Host "  1) Settings → Start command → node src/index.cjs (guardar)"
Write-Host "  2) Environment → DATABASE_URL (Neon, con sslmode=require & channel_binding=require)"
Write-Host "  3) Manual Deploy → Clear build cache & Deploy"
Write-Host ""
Write-Host "Cuando termine el deploy, prueba:"
Write-Host '  Invoke-RestMethod https://vida-digital-api.onrender.com/health'
Write-Host '  Invoke-RestMethod https://vida-digital-api.onrender.com/db/diag'
Write-Host '  Invoke-RestMethod "https://vida-digital-api.onrender.com/products?limit=20"'