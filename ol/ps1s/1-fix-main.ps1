
param(
  [string]$RepoRoot = "." ,
  [switch]$Commit
)


function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $enc = New-Object System.Text.UTF8Encoding($false)
  $bytes = $enc.GetBytes($Content)
  [System.IO.File]::WriteAllBytes($Path, $bytes)
}


function Backup-File($Path) {{ if(Test-Path $Path) {{ Copy-Item $Path "$($Path).bak20251006_201254" -Force }} }}

$main = Join-Path $RepoRoot "web/src/main.tsx"
if(!(Test-Path $main)) {{ Write-Error "No se encontró $main. Ejecuta el script en la RAÍZ del repo (o usa -RepoRoot)."; exit 1 }}

$content = Get-Content $main -Raw

# Asegurar import de BootExtras
if($content -notmatch '(?m)^\s*import\s+BootExtras\s+from\s+["'+"']\./boot-extras["+"'"+'];\s*$'){{
  if($content -match '(?ms)^(?<imports>(\s*import .*?;\s*)+)'){{
    $imports = $Matches['imports']
    $newImports = $imports + "import BootExtras from ""./boot-extras"";`n"
    $content = $content -replace [Regex]::Escape($imports), [System.Text.RegularExpressions.Regex]::Escape($newImports).Replace('\\','\')
  }} else {{
    $content = "import BootExtras from ""./boot-extras"";`n" + $content
  }}
}}

# Insertar <BootExtras /> dentro de <BrowserRouter> si no existe
if($content -notmatch '<BootExtras\s*/>'){{
  if($content -match '<BrowserRouter\s*>\s*'){{
    $content = $content -replace '<BrowserRouter\s*>', "<BrowserRouter>`n        <BootExtras />"
  }} else {{
    Write-Warning "No se encontró <BrowserRouter>. Se añadió el import, pero no se insertó <BootExtras /> automáticamente."
  }}
}}

# Asegurar que ReactDOM import no esté truncado (si detecta 'import ReactDOM' sin 'from')
if($content -match '(?m)^\s*import\s+ReactDOM\s*;$'){{
  $content = $content -replace '(?m)^\s*import\s+ReactDOM\s*;$', 'import ReactDOM from "react-dom/client";'
}

Backup-File $main
Write-Utf8NoBom -Path $main -Content $content
Write-Host "✅ Fix aplicado en $main"

# Commit opcional
if($Commit) {{ 
  if(Get-Command git -ErrorAction SilentlyContinue) {{ 
    git add $main
    git commit -m "fix(web): import BootExtras en main.tsx e inserción en BrowserRouter"
  }} else {{ Write-Warning "git no está disponible en el PATH. Saltando commit." }}
}}
