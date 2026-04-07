/**
 * @jest-environment node
 */
/**
 * @jest-environment node
 */
import * as XLSX from 'xlsx';

const getServerSession = jest.fn();

let sqlCalls: Array<{ text: string; values: unknown[] }> = [];
let sqlImpl: (text: string, values: unknown[]) => Promise<any[]> = async () => [];

const sql = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
  const text = strings.join('');
  sqlCalls.push({ text, values });
  return sqlImpl(text, values);
});

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

jest.mock('@/lib/services/product-service', () => ({
  recalculateNuevoFlags: jest.fn(async () => 0),
}));

function buildWorkbook(): XLSX.WorkBook {
  const rows: any[][] = [];
  rows[0] = ['LISTA PRECIO GALPON 07/04/2026'];
  rows[1] = ['IMPORT EXPORT SANJH LTDA.'];
  rows[4] = [
    'CODIGO',
    'NROINGRESO',
    'SALDO',
    'UMED',
    'CIF',
    'COSTO',
    'PRCVENTA',
    'PRCMINIMO',
    'CANTCAJA',
    'PESOCAJA',
    'CUBICAJA',
    'DETALLE',
  ];
  rows[5] = [
    'ABC123',
    '24-000001',
    10,
    'UN',
    100,
    90,
    150,
    140,
    1,
    2,
    3,
    'Producto de prueba',
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

describe('Importador - empresa autodetect', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    sql.mockClear();
    sqlCalls = [];
    sqlImpl = async () => [];
  });

  test('Parser detecta empresa desde celda A2', async () => {
    let parserModule: any = null;
    try {
      parserModule = await import('@/app/(app)/admin/importar/parser');
    } catch {
      parserModule = null;
    }

    if (!parserModule?.parseImportWorkbook) {
      expect(parserModule?.parseImportWorkbook).toBeDefined();
      return;
    }

    const wb = buildWorkbook();
    const { empresaNombre } = parserModule.parseImportWorkbook(wb);
    expect(empresaNombre).toBe('IMPORT EXPORT SANJH LTDA.');
  });

  test('Parser falla si A2 está vacío o no reconocido', async () => {
    let parserModule: any = null;
    try {
      parserModule = await import('@/app/(app)/admin/importar/parser');
    } catch {
      parserModule = null;
    }

    if (!parserModule?.parseImportWorkbook) {
      expect(parserModule?.parseImportWorkbook).toBeDefined();
      return;
    }

    const wb = buildWorkbook();
    const ws = wb.Sheets['Sheet1'];
    ws['A2'] = { t: 's', v: '' };

    expect(() => parserModule.parseImportWorkbook(wb)).toThrow();
  });

  test('Backend resuelve empresaId desde empresaNombre', async () => {
    const { POST } = await import('@/app/api/admin/importar/route');

    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [1] },
    });

    sqlImpl = async (text: string) => {
      if (text.includes('SELECT id FROM empresas')) return [{ id: 1 }];
      if (text.includes('SELECT COUNT')) return [{ count: 0 }];
      return [];
    };

    const req = new Request('http://localhost/api/admin/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaNombre: 'IMPORT EXPORT SANJH LTDA.',
        products: [
          {
            codigo: 'ABC123',
            detalle: 'Producto',
            prcventa: 10,
            prcminimo: 9,
            costo: 8,
            cif: 7,
            saldo: 5,
            nroingreso: '24-000001',
            umed: 'UN',
            cantcaja: 1,
            pesocaja: 1,
            cubicaja: 1,
          },
        ],
      }),
    });

    await POST(req);

    const lookupCall = sqlCalls.find((c) => c.text.includes('SELECT id FROM empresas'));
    expect(lookupCall).toBeDefined();

    const insertCall = sqlCalls.find((c) => c.text.includes('INSERT INTO productos'));
    expect(insertCall).toBeDefined();
    expect(insertCall?.values?.[0]).toBe(1);
  });

  test('Backend rechaza empresa no reconocida', async () => {
    const { POST } = await import('@/app/api/admin/importar/route');

    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [1] },
    });

    sqlImpl = async (text: string) => {
      if (text.includes('SELECT id FROM empresas')) return [];
      return [];
    };

    const req = new Request('http://localhost/api/admin/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaNombre: 'IMPORT EXPORT SANJH LTDA.',
        products: [
          {
            codigo: 'ABC123',
            detalle: 'Producto',
            prcventa: 10,
            prcminimo: 9,
            costo: 8,
            cif: 7,
            saldo: 5,
            nroingreso: '24-000001',
            umed: 'UN',
            cantcaja: 1,
            pesocaja: 1,
            cubicaja: 1,
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Empresa no reconocida');
  });
});
