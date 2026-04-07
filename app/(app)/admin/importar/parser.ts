import * as XLSX from 'xlsx';

interface Product {
  codigo: string;
  detalle: string;
  prcventa: number;
  prcminimo: number;
  costo: number;
  cif: number;
  saldo: number;
  nroingreso: string;
  umed: string;
  cantcaja: number;
  pesocaja: number;
  cubicaja: number;
  _valid: boolean;
}

export function parseImportWorkbook(wb: XLSX.WorkBook): {
  empresaNombre: string;
  products: Product[];
} {
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  const empresaCell = sheet?.['A2'];
  const empresaNombre = String(empresaCell?.v ?? '').trim();
  if (!empresaNombre) {
    throw new Error(
      'No se pudo detectar la empresa desde el archivo Excel. Verifica que la celda A2 contenga el nombre de la empresa.'
    );
  }

  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rawData.length <= 4) {
    throw new Error(
      'El archivo debe tener al menos 5 filas (título, empresa, fecha, vacío, encabezados).'
    );
  }

  const headers = (rawData[4] as string[]).map((h) =>
    (h || '').toString().trim().toUpperCase()
  );

  const idxCodigo = headers.indexOf('CODIGO');
  const idxDetalle = headers.indexOf('DETALLE');
  const idxPrcVenta = headers.indexOf('PRCVENTA');
  const idxPrcMinimo = headers.indexOf('PRCMINIMO');
  const idxCosto = headers.indexOf('COSTO');
  const idxCif = headers.indexOf('CIF');
  const idxSaldo = headers.indexOf('SALDO');
  const idxNroIngreso = headers.indexOf('NROINGRESO');
  const idxUmed = headers.indexOf('UMED');
  const idxCantCaja = headers.indexOf('CANTCAJA');
  const idxPesoCaja = headers.indexOf('PESOCAJA');
  const idxCubiCaja = headers.indexOf('CUBICAJA');

  if (idxCodigo === -1 || idxDetalle === -1) {
    throw new Error(
      'El Excel debe contener los encabezados "CODIGO" y "DETALLE" exactamente en la fila 5 (índice 4).'
    );
  }

  const products: Product[] = [];
  for (let i = 5; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0 || !row[idxCodigo]) continue;

    const p: Product = {
      codigo: String(row[idxCodigo] || '').trim(),
      detalle: String(row[idxDetalle] || ''),
      prcventa: idxPrcVenta !== -1 ? parseFloat(row[idxPrcVenta]) : 0,
      prcminimo: idxPrcMinimo !== -1 ? parseFloat(row[idxPrcMinimo]) : 0,
      costo: idxCosto !== -1 ? parseFloat(row[idxCosto]) : 0,
      cif: idxCif !== -1 ? parseFloat(row[idxCif]) : 0,
      saldo: idxSaldo !== -1 ? parseFloat(row[idxSaldo]) : 0,
      nroingreso: idxNroIngreso !== -1 ? String(row[idxNroIngreso] || '') : '',
      umed: idxUmed !== -1 ? String(row[idxUmed] || '') : 'UN',
      cantcaja: idxCantCaja !== -1 ? parseFloat(row[idxCantCaja]) : 1,
      pesocaja: idxPesoCaja !== -1 ? parseFloat(row[idxPesoCaja]) : 0,
      cubicaja: idxCubiCaja !== -1 ? parseFloat(row[idxCubiCaja]) : 0,
      _valid: false,
    };

    p._valid = p.codigo.length > 0;
    products.push(p);
  }

  return { empresaNombre, products };
}
