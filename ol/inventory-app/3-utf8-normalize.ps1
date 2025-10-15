
param(
  [string]$RepoRoot = ".",
  [switch]$Commit
)


function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $enc = New-Object System.Text.UTF8Encoding($false)
  $bytes = $enc.GetBytes($Content)
  [System.IO.File]::WriteAllBytes($Path, $bytes)
}


function Should-ProcessFile([IO.FileInfo]$f) {{
  $excludeDirs = @("\.git", "node_modules", "dist", "build", ".next", "out")
  foreach($ex in $excludeDirs){ if($f.FullName -match [Regex]::Escape($ex)) { return $false } }
  $exts = @(".ts",".tsx",".js",".jsx",".css",".html",".json",".sql",".md",".yml",".yaml",".txt")
  return $exts -contains $f.Extension.ToLower()
}}

$files = Get-ChildItem -Path $RepoRoot -Recurse -File | Where-Object { Should-ProcessFile $_ }

$map = @{  # Correcciones de mojibake comunes
  "Ã¡"="á"; "Ã©"="é"; "Ã­"="í"; "Ã³"="ó"; "Ãº"="ú"; "Ã±"="ñ";
  "Ã"="Ñ"; "Ã"="Á"; "Ã"="É"; "Ã"="Í"; "Ã"="Ó"; "Ã"="Ú";
  "Â¿"="¿"; "Â¡"="¡"; "Âº"="º"; "Âª"="ª"; "Â·"="·"; "Â°"="°";
  "â€“"="–"; "â€”"="—"; "â€¦"="…"; "â€œ"="“"; "â€"="”"; "â€˜"="‘"; "â€™"="’";
  "Â«"="«"; "Â»"="»"; "Â‚"="‚"; "Â„"="„"; "Â†"="†"; "Â‡"="‡";
  "Â " = " "; "Â" = ""
}

[int]$changed = 0
foreach($f in $files){
  $text = Get-Content -LiteralPath $f.FullName -Raw

  $orig = $text
  foreach($k in $map.Keys){ $text = $text -replace [Regex]::Escape($k), [System.Text.RegularExpressions.Regex]::Escape($map[$k]).Replace('\\','\') }

  if($text -ne $orig){
    $bak = "$($f.FullName).utf8fix20251006_201254"
    if(!(Test-Path $bak)){ Copy-Item -LiteralPath $f.FullName -Destination $bak -Force }
    Write-Utf8NoBom -Path $f.FullName -Content $text
    $changed++
    Write-Host "Arreglado: $($f.FullName)"
  } else {
    Write-Utf8NoBom -Path $f.FullName -Content $text
  }
}

Write-Host "✅ Archivos modificados (con cambios de texto): $changed"

if($Commit -and $changed -gt 0) {
  if(Get-Command git -ErrorAction SilentlyContinue) { 
    git add .
    git commit -m "chore: normalizar UTF-8 y corregir mojibake español (batch)"
  } else { Write-Warning "git no está disponible en el PATH. Saltando commit." }
}
