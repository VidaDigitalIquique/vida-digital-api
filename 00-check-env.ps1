# 00-check-env.ps1
$ErrorActionPreference = "Stop"
Write-Host "`n=== CHECK ENTORNO ===" -ForegroundColor Cyan
Write-Host "PSVersion: $($PSVersionTable.PSVersion)"
try { node -v } catch { Write-Warning "Node NO encontrado (instala Node LTS)"; }
try { npm -v }  catch { Write-Warning "npm NO encontrado (viene con Node)"; }
try { git --version } catch { Write-Warning "git NO encontrado (instala Git)"; }
try { gh --version }  catch { Write-Warning "gh NO encontrado (opcional; sirve para crear el repo en GitHub)"; }

$path = Get-Location
Write-Host "Carpeta actual: $path"
try {
  $testFile = Join-Path $path ".__ps_write_test"
  'ok' | Out-File -FilePath $testFile -Encoding utf8
  Remove-Item $testFile -Force
  Write-Host "Permisos de escritura: OK"
} catch {
  Write-Warning "Sin permisos de escritura en la carpeta actual. Abre PowerShell como usuario normal (no System) o cambia de carpeta."
}

Write-Host "`nSugerencias si hubo errores:" -ForegroundColor Yellow
Write-Host " - Ejecuta en esta misma consola:" -ForegroundColor Yellow
Write-Host "   Set-ExecutionPolicy -Scope Process Bypass" -ForegroundColor Yellow
Write-Host "   Unblock-File .\04-deploy-render.ps1 (si ya lo tienes)" -ForegroundColor Yellow
Write-Host " - Asegúrate de tener Node LTS (incluye npm) y Git instalados." -ForegroundColor Yellow
