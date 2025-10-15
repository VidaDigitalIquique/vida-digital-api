Write-Host "Actualizando endpoint /products para unir vida y sanjh..." -ForegroundColor Cyan

$indexPath = "index.js"

if (-not (Test-Path $indexPath)) {
  Write-Host "No se encontró index.js en el directorio actual." -ForegroundColor Red
  exit 1
}

# Backup previo
Copy-Item $indexPath "$indexPath.bak.before_union" -Force

# Código nuevo del endpoint
$updatedContent = @'
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
    console.error("Error en /products:", err.message);
    res.status(500).json({ error: err.message });
  }
});
'@

# Eliminar versiones viejas del endpoint y agregar la nueva
(Get-Content $indexPath) |
  Where-Object {$_ -notmatch "/products"} |
  Set-Content $indexPath

Add-Content $indexPath "`n$updatedContent"

Write-Host "Endpoint /products actualizado exitosamente." -ForegroundColor Green

# Forzar redeploy
(Get-Date) | Out-File "redeploy.touch" -Encoding utf8
git add .; git commit -m "feat: /products une vida.producto y sanjh.producto" --allow-empty; git push origin main

Write-Host "Cambios enviados. Render redeploy iniciará en 1-2 minutos." -ForegroundColor Cyan
