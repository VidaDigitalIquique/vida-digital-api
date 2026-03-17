Write-Host "🧹 Corrigiendo endpoint /products (eliminando inventar.producto)..." -ForegroundColor Cyan

$indexPath = "index.js"

if (-not (Test-Path $indexPath)) {
  Write-Host "❌ No se encontró index.js en esta carpeta." -ForegroundColor Red
  exit 1
}

# Crear backup de seguridad
Copy-Item $indexPath "$indexPath.bak.cleanup" -Force

# Leer todo el archivo y eliminar referencias viejas
$content = Get-Content $indexPath -Raw

# Quitar cualquier línea con inventar.producto
$content = $content -replace "(?i)inventar\.producto", ""

# Quitar posibles duplicados antiguos del endpoint /products
$content = $content -replace "(?s)app\.get\(\"/products\".*?\}\);", ""

# Agregar versión correcta del endpoint
$updatedEndpoint = @'
app.get("/products", async (req, res) => {
  try {
    const query = `
      SELECT 'vida' AS origen, codigo, descripcion, marca, familia, stock, precio
      FROM vida.producto
      UNION ALL
      SELECT 'sanjh' AS origen, codigo, descripcion, marca, familia, stock, precio
      FROM sanjh.producto
      LIMIT 500;
    `;
    const result = await pool.query(query);
    res.json({ count: result.rowCount, products: result.rows });
  } catch (err) {
    console.error("❌ Error en /products:", err.message);
    res.status(500).json({ error: err.message });
  }
});
'@

# Reescribir el archivo limpio
Set-Content $indexPath $content
Add-Content $indexPath "`n$updatedEndpoint"

Write-Host "✅ Endpoint /products reescrito correctamente." -ForegroundColor Green

# Redeploy forzado
(Get-Date) | Out-File "redeploy.touch" -Encoding utf8
git add .; git commit -m "fix: limpiar inventar.producto y reescribir /products UNION ALL" --allow-empty; git push origin main

Write-Host "🚀 Cambios enviados. Render redeploy iniciará en 1–2 minutos." -ForegroundColor Cyan
