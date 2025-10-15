# 03-expose-ngrok.ps1
# Requiere ngrok instalado y authtoken configurado (ngrok config add-authtoken <token>)
$ErrorActionPreference = "Stop"
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  Write-Error "No encuentro 'ngrok'. Instálalo y vuelve a correr este script."
}
Write-Host "Exponiendo http://localhost:4000 ..." -ForegroundColor Cyan
ngrok http 4000
