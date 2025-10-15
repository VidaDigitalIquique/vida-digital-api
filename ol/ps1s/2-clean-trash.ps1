
param(
  [string]$RepoRoot = ".",
  [switch]$DryRun,
  [switch]$Commit
)

$web = Join-Path $RepoRoot "web"
if(!(Test-Path $web)) { Write-Error "No se encontró carpeta web/"; exit 1 }

$stamp = "20251006_201254"
$trash = Join-Path $web ("_trash_" + $stamp)
if(!(Test-Path $trash)) { New-Item -ItemType Directory -Path $trash | Out-Null }

# Lista de archivos basura conocidos (reportados)
$badNames = @(
  "Math.abs((b.difference_boxes",
  "s.trim())",
  "setCodesText(e.target.value)}",
  "{{",
  "{{.ts",
  "{{.tsx",
  "{"
)

# Mover archivos sospechosos por nombre exacto en la raíz de web/ y subcarpetas
$targets = @()
foreach($bn in $badNames) { $targets += Get-ChildItem -Path $web -Recurse -File -Filter $bn -ErrorAction SilentlyContinue }

# Mover *.bak_* de trabajo a la papelera (conservamos copia única en trash)
$bakFiles = Get-ChildItem -Path $web -Recurse -File -Include *.bak_* -ErrorAction SilentlyContinue

# Mover archivos de tamaño 0 en web/ (excepto .gitkeep)
$zero = Get-ChildItem -Path $web -Recurse -File | Where-Object { $_.Length -eq 0 -and $_.Name -ne ".gitkeep" }

$toMove = ($targets + $bakFiles + $zero) | Sort-Object FullName -Unique

if($toMove.Count -eq 0){ Write-Host "No se encontraron archivos basura para mover."; exit 0 }

Write-Host "Se moverán $($toMove.Count) archivo(s) a $trash"
foreach($f in $toMove){ 
  Write-Host " - $($f.FullName)"
  if(-not $DryRun){ 
    $dest = Join-Path $trash $f.Name
    Move-Item -LiteralPath $f.FullName -Destination $dest -Force
  }
}

if(-not $DryRun -and $Commit) { 
  if(Get-Command git -ErrorAction SilentlyContinue) { 
    git add $web
    git commit -m "chore(web): limpiar archivos basura y .bak_* → $($trash | Split-Path -Leaf)"
  } else { Write-Warning "git no está disponible en el PATH. Saltando commit." }
}
