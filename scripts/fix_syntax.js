const fs = require('fs');
const path = require('path');
const rootDir = path.join(__dirname, '..');

function fixFile(filePath, search, replace) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fixed = content.replace(search, replace);
  if (content === fixed) {
    console.log('No match found in: ' + filePath);
    return false;
  }
  fs.writeFileSync(filePath, fixed, 'utf8');
  console.log('Fixed: ' + filePath);
  return true;
}

// Fix 1: bodega/client_page.tsx - backtick template in JSX
const bodegaPath = path.join(rootDir, 'app', '(app)', 'bodega', 'client_page.tsx');
const search1 = '(previewDiferencia > 0 ? `+${previewDiferencia}` : previewDiferencia)';
const replace1 = "(previewDiferencia > 0 ? '+' + previewDiferencia : previewDiferencia)";
fixFile(bodegaPath, search1, replace1);

// Fix 2: Also check inventario route.ts for dynamic sql() calls with strings
const inventarioRoutePath = path.join(__dirname, 'app', 'api', 'inventario', 'route.ts');
let invContent = fs.readFileSync(inventarioRoutePath, 'utf8');
console.log('\n--- inventario route.ts type errors ---');
console.log('Lines with sql():');
invContent.split('\n').forEach((l, i) => { if (l.includes('sql(')) console.log((i+1) + ': ' + l); });
