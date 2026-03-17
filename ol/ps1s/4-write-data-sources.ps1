
param(
  [string]$RepoRoot = ".",
  [switch]$Commit,
  [switch]$Force  # sobrescribir sin preguntar
)

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $enc = New-Object System.Text.UTF8Encoding($false)
  $bytes = $enc.GetBytes($Content)
  [System.IO.File]::WriteAllBytes($Path, $bytes)
}

$target = Join-Path $RepoRoot "server/src/config/data-sources.ts"
$dir = Split-Path $target -Parent
if(!(Test-Path $dir)){ New-Item -ItemType Directory -Path $dir | Out-Null }

if((Test-Path $target) -and -not $Force){
  Write-Warning "El archivo ya existe: $target"
  Write-Host "Usa -Force para sobrescribir, o borra/mueve el archivo existente."
  exit 1
}

$ts = @'
/**
 * data-sources.ts
 * Mapeos explícitos de tablas/columnas reales → campos lógicos usados en rutas del server.
 *
 * TODO: Ajusta schema, tablas y columnas a tu Neon. Este archivo es solo un ejemplo coherente.
 */

export type ColumnMap = {
  /** tabla completa "schema.table" */
  table: string;
  /** columna código único del producto */
  code: string;
  /** columna descripción del producto */
  description?: string;
  /** costo y precio en USD (opcional según origen) */
  costUSD?: string;
  priceUSD?: string;
  /** stock en unidades y/o en cajas */
  unitsInStock?: string;
  boxesInStock?: string;
  /** unidades por caja */
  unitsPerBox?: string;
  /** ubicación/section en bodega */
  location?: string;
  section?: string;
  /** marca de tiempo de actualización */
  updatedAt?: string;
};

export const DataSources = {
  products: {
    table: "public.producto",         // TODO: schema y tabla reales
    code: "codunico",                 // TODO
    description: "descrip",           // TODO
    costUSD: "costo_usd",             // TODO (o null si no existe)
    priceUSD: "precio_usd",           // TODO
    unitsInStock: "stocdisp",         // TODO (si el stock vive en otra tabla, deja null y únelas en la query)
    unitsPerBox: "cant_x_caja",       // TODO
    updatedAt: "updated_at",          // TODO
  } as ColumnMap,

  inventory: {
    table: "public.inventar",         // TODO: origen con stock por ubicación
    code: "codunico",                 // TODO
    location: "ubicacion",            // TODO
    unitsInStock: "stocdisp",         // TODO
    boxesInStock: "stoc_cajas",       // TODO
    updatedAt: "updated_at",          // TODO
  } as ColumnMap,

  locations: {
    table: "public.ubicaciones",      // TODO: catálogo de ubicaciones/secciones
    code: "codunico",                 // TODO (si aplica)
    section: "seccion",               // TODO
    location: "ubicacion",            // TODO
    updatedAt: "updated_at",          // TODO
  } as ColumnMap,
} as const;

export type DataSources = typeof DataSources;
'@

if(Test-Path $target){ Copy-Item $target "$($target).bak20251006_201254" -Force }
Write-Utf8NoBom -Path $target -Content $ts
Write-Host "✅ data-sources.ts escrito en: $target"

if($Commit) {
  if(Get-Command git -ErrorAction SilentlyContinue) {
    git add $target
    git commit -m "feat(server): data-sources.ts de ejemplo con mapeos explícitos y TODOs"
  } else { Write-Warning "git no está disponible en el PATH. Saltando commit." }
}
