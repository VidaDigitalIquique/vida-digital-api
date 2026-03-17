
// Mock parsing logic from lib/excel.ts and client_page.tsx
function verifyParsingLogic(rawData: any[][], limitRows = 0): any[] {
  console.log(`Testing with rawData length: \${rawData.length}`);
  
  if (rawData.length <= 4) {
    console.log('Skipping: rawData too short');
    return [];
  }
  
  // Row index 4 contains the actual column headers
  const headersRow = rawData[4];
  if (!headersRow) {
    console.log('Skipping: no header row at index 4');
    return [];
  }

  const headers = headersRow.map((h: any) => String(h || '').trim().toUpperCase());
  console.log('Headers found:', headers);
  
  // Validation as per requirement
  if (!headers.includes("CODIGO") || !headers.includes("DETALLE")) {
    throw new Error('El archivo Excel no tiene el formato esperado. Faltan encabezados "CODIGO" o "DETALLE" en la fila 5 (índice 4).');
  }

  const EXPECTED_COLUMNS = [
    "CODIGO", "NROINGRESO", "SALDO", "UMED", "CIF", "COSTO", 
    "PRCVENTA", "PRCMINIMO", "CANTCAJA", "PESOCAJA", "CUBICAJA", "DETALLE"
  ];

  const parsedData = [];
  const max = limitRows > 0 ? Math.min(rawData.length, 5 + limitRows) : rawData.length;

  for (let i = 5; i < max; i++) {
    const row = rawData[i];
    // Skip if row is empty or has no code
    if (!row || !row.length || !row[headers.indexOf("CODIGO")]) {
      console.log(`Skipping row \${i} (empty or no CODIGO)`);
      continue;
    }

    const record: any = {};
    EXPECTED_COLUMNS.forEach(col => {
      const idx = headers.indexOf(col);
      if (idx !== -1) {
        record[col.toLowerCase()] = row[idx];
      } else {
        record[col.toLowerCase()] = null;
      }
    });

    parsedData.push(record);
  }

  return parsedData;
}

function test() {
  console.log('--- Verification: Excel Row Indexing & Mapping ---');

  // Case 1: Correct structure
  const validData = [
    ['TITULO'], // 0
    ['EMPRESA'], // 1
    ['FECHA'], // 2
    [''], // 3
    ['CODIGO', 'DETALLE', 'SALDO', 'PRCVENTA', 'COSTO'], // 4 (HEADERS)
    ['C001', 'Desc 1', 10, 100, 80], // 5 (DATA)
    ['C002', 'Desc 2', 5, 200, 150], // 6 (DATA)
    [], // 7 (EMPTY)
    ['C003', 'Desc 3', 2, 50, 40], // 8 (DATA)
  ];

  try {
    const result = verifyParsingLogic(validData);
    console.log('Result length:', result.length);
    if (result.length !== 3) throw new Error(`Expected 3 rows, got \${result.length}`);
    if (result[0].codigo !== 'C001' || result[0].detalle !== 'Desc 1') throw new Error('Data mapping failed');
    if (result[2].codigo !== 'C003') throw new Error('Skipping empty row failed');
    console.log('✅ Case 1: Valid structure parsed correctly.');
  } catch (err) {
    console.error('❌ Case 1 failed:', err);
    process.exit(1);
  }

  // Case 2: Headers in wrong row (e.g. at index 3 instead of 4)
  const misplacedHeaders = [
    ['TITULO'], 
    ['EMPRESA'], 
    ['FECHA'], 
    ['CODIGO', 'DETALLE', 'SALDO'], // Headers at index 3
    ['TITULO REPETIDO?'], // Something else at index 4
    ['C001', 'Desc 1', 10]
  ];
  try {
    verifyParsingLogic(misplacedHeaders);
    console.error('❌ Case 2 failed: Should have thrown error for wrong header row');
    process.exit(1);
  } catch (err: any) {
    console.log('✅ Case 2: Correctly rejected headers at wrong row:', err.message);
  }

  // Case 3: Missing required headers at index 4
  const missingHeaders = [
    ['T'],['E'],['D'],[''],
    ['SKU', 'DESCRIPTION', 'STOCK'], // Missing CODIGO/DETALLE
    ['S1', 'D1', 10]
  ];
  try {
    verifyParsingLogic(missingHeaders);
    console.error('❌ Case 3 failed: Should have thrown error for missing headers');
    process.exit(1);
  } catch (err: any) {
    console.log('✅ Case 3: Correctly rejected missing headers:', err.message);
  }

  console.log('--- Verification Success ---');
}

test();
