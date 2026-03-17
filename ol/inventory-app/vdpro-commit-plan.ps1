
param(
  [string]$RepoRoot = ".",
  [switch]$Commit,
  [switch]$DryRunClean,
  [switch]$ForceDataSources
)

# Detectar ruta de scripts (misma carpeta del .ps1)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$steps = @(
  @{ name="1-fix-main.ps1";        args={ " -RepoRoot `"$RepoRoot`" " + ($(if($Commit){" -Commit"} else {""})) } },
  @{ name="2-clean-trash.ps1";     args={ " -RepoRoot `"$RepoRoot`" " + ($(if($Commit){" -Commit"} else {""})) + ($(if($DryRunClean){" -DryRun"} else {""})) } },
  @{ name="3-utf8-normalize.ps1";  args={ " -RepoRoot `"$RepoRoot`" " + ($(if($Commit){" -Commit"} else {""})) } },
  @{ name="4-write-data-sources.ps1"; args={ " -RepoRoot `"$RepoRoot`" " + ($(if($Commit){" -Commit"} else {""})) + ($(if($ForceDataSources){" -Force"} else {""})) } }
)

foreach($s in $steps){
  $path = Join-Path $ScriptDir $s.name
  if(!(Test-Path $path)){ Write-Error "No se encontró $($s.name) junto al script maestro."; exit 1 }
  Write-Host ""
  Write-Host "▶ Ejecutando $($s.name)..." -ForegroundColor Cyan
  $args = & $s.args.Invoke()
  Write-Host "   con args:$args"
  & powershell -ExecutionPolicy Bypass -File $path @args
  if($LASTEXITCODE -ne 0){ Write-Error "Falló $($s.name). Abortando."; exit 1 }
}

Write-Host ""
Write-Host "✅ Todo OK. Sugerencia:" -ForegroundColor Green
Write-Host "   1) cd server; npm i; npx prisma generate; npx prisma migrate deploy; npm run dev"
Write-Host "   2) cd web; npm i; npm run dev"
