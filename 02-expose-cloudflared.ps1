# 02-expose-cloudflared.ps1
# Requiere cloudflared instalado en el PATH.
# Descarga: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
$ErrorActionPreference = "Stop"
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Error "No encuentro 'cloudflared'. Instálalo y vuelve a correr este script."
}
Write-Host "Exponiendo http://localhost:4000 ..." -ForegroundColor Cyan
cloudflared tunnel --url http://localhost:4000
