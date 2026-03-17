import * as xlsx from 'xlsx';

export function parseExcelData(fileBuffer: Buffer, limitRows = 0): any[] {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Raw json array of arrays to handle custom header structures
  const rawData: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (rawData.length <= 4) return [];
  
  // Row index 4 contains the actual column headers
  const headersRow = rawData[4];
  if (!headersRow) return [];

  const headers = headersRow.map((h: any) => String(h || '').trim().toUpperCase());
  
  // Validation: Row index 4 must contain "CODIGO" and "DETALLE"
  if (!headers.includes("CODIGO") || !headers.includes("DETALLE")) {
    throw new Error('El archivo Excel no tiene el formato esperado. Faltan encabezados "CODIGO" o "DETALLE" en la fila 5 (índice 4).');
  }

  // Hardcoded expected column names as per USER_REQUEST
  const EXPECTED_COLUMNS = [
    "CODIGO", "NROINGRESO", "SALDO", "UMED", "CIF", "COSTO", 
    "PRCVENTA", "PRCMINIMO", "CANTCAJA", "PESOCAJA", "CUBICAJA", "DETALLE"
  ];

  const parsedData = [];
  const max = limitRows > 0 ? Math.min(rawData.length, 5 + limitRows) : rawData.length;

  for (let i = 5; i < max; i++) {
    const row = rawData[i];
    if (!row || !row.length || !row[headers.indexOf("CODIGO")]) continue;

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
