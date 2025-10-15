# 08-redeploy-touch.ps1
$ErrorActionPreference = "Stop"
cd ".\vida-digital-api"
"// touch $(Get-Date -Format o)" | Out-File -Append .\index.js
git add index.js
git commit -m "chore: touch for redeploy"
git push
Write-Host "Empujado. Render debería redeployar automáticamente." -ForegroundColor Green
