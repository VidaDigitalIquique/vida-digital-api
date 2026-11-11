/**
 * @jest-environment node
 *
 * S6 — Fase B: exportar el informe de comisiones a .xlsx (R10).
 * Estado inicial: ROJO (lib/comisiones-xlsx.ts no existe y la ruta ignora `formato`).
 */
import * as XLSX from 'xlsx';
import { getServerSession } from 'next-auth';
import { fetchComisiones, leerComisionPct } from '@/lib/comisiones';
import type { InformeComisiones } from '@/lib/comisiones-utils';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    body: unknown;
    headers: Record<string, string>;

    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = init?.headers ?? {};
    }

    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new MockNextResponse(body, init);
    }

    async json() {
      return this.body;
    }
  }
  return { NextResponse: MockNextResponse };
});

jest.mock('@/lib/comisiones', () => ({
  fetchComisiones: jest.fn(),
  leerComisionPct: jest.fn(),
  guardarComisionPct: jest.fn(),
}));

jest.mock('@/lib/fechas', () => ({ hoyCL: jest.fn(() => '2026-11-11') }));

jest.mock('@/config/feature-flags.json', () => ({ 'vendedores-modulo': true }));

const flags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;
const fetchMock = fetchComisiones as jest.MockedFunction<typeof fetchComisiones>;
const pctMock = leerComisionPct as jest.MockedFunction<typeof leerComisionPct>;

const ENCABEZADOS = ['Vendedor', 'Notas facturadas', 'Total vendido USD', '% comisión', 'Comisión USD'];

const INFORME: InformeComisiones = {
  mes: '2026-11',
  mes_etiqueta: 'noviembre 2026',
  comision_pct: 0.5,
  filas: [
    { vendedor: 'ANGELA', notas: 2, total_usd: 10980.1, comision_pct: 0.5, comision_usd: 54.9 },
    { vendedor: 'PRAVIN', notas: 1, total_usd: 100, comision_pct: 0.5, comision_usd: 0.5 },
  ],
  totales: { notas: 3, total_usd: 11080.1, comision_usd: 55.4 },
};

type RespuestaMock = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  json(): Promise<unknown>;
};

let GET: typeof import('@/app/api/vendedores/comisiones/route').GET;

function req(qs = '') {
  return { url: `http://localhost/api/vendedores/comisiones${qs ? `?${qs}` : ''}` } as Request;
}

function pedir(qs: string): Promise<RespuestaMock> {
  return GET(req(qs)) as unknown as Promise<RespuestaMock>;
}

function sesion(id: string | null, rol = 'admin') {
  (getServerSession as jest.Mock).mockResolvedValue(
    id === null ? { user: { rol } } : { user: { rol, id } }
  );
}

function hoja(res: RespuestaMock) {
  const wb = XLSX.read(res.body as Buffer, { type: 'buffer', cellNF: true });
  return { wb, ws: wb.Sheets[wb.SheetNames[0]] };
}

beforeAll(async () => {
  const mod = await import('@/app/api/vendedores/comisiones/route');
  GET = mod.GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  flags['vendedores-modulo'] = true;
  sesion('1');
  fetchMock.mockResolvedValue(INFORME);
  pctMock.mockResolvedValue(0.5);
});

describe('archivo .xlsx (R10)', () => {
  it('T1: hoja y filas son exactamente las del informe, con fila TOTAL', async () => {
    const res = await pedir('mes=2026-11&formato=xlsx');
    expect(res.status).toBe(200);

    const { wb, ws } = hoja(res);
    expect(wb.SheetNames).toEqual(['noviembre 2026']);
    expect(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })).toEqual([
      ENCABEZADOS,
      ['ANGELA', 2, 10980.1, 0.5, 54.9],
      ['PRAVIN', 1, 100, 0.5, 0.5],
      ['TOTAL', 3, 11080.1, 0.5, 55.4],
    ]);
  });

  it('T2: los numeros son numeros en Excel, no texto', async () => {
    const { ws } = hoja(await pedir('mes=2026-11&formato=xlsx'));
    for (const c of ['B2', 'C2', 'D2', 'E2', 'B4', 'C4', 'D4', 'E4']) {
      expect(ws[c]?.t).toBe('n');
      expect(typeof ws[c]?.v).toBe('number');
    }
  });

  it('T3: moneda con 2 decimales y % con 2 decimales (sin multiplicar por 100)', async () => {
    const { ws } = hoja(await pedir('mes=2026-11&formato=xlsx'));
    expect(ws['C2'].z).toBe('"$"#,##0.00');
    expect(ws['E2'].z).toBe('"$"#,##0.00');
    expect(ws['D2'].z).toBe('0.00"%"');
    expect(ws['C4'].z).toBe('"$"#,##0.00');
    expect(ws['E4'].z).toBe('"$"#,##0.00');
    expect(ws['D4'].z).toBe('0.00"%"');
  });

  it('T4: cabeceras de descarga con el mes en el nombre del archivo', async () => {
    const res = await pedir('mes=2026-11&formato=xlsx');
    expect(res.headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="comisiones-2026-11.xlsx"');
  });

  it('T5: no recalcula: usa fetchComisiones con el mes, hoy de Chile y el % de la base', async () => {
    await pedir('mes=2026-11&formato=xlsx');
    expect(pctMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('2026-11', '2026-11-11', 0.5);
  });

  it('T6: mes sin datos -> encabezado y fila TOTAL en 0', async () => {
    fetchMock.mockResolvedValue({
      mes: '2025-01',
      mes_etiqueta: 'enero 2025',
      comision_pct: 0.5,
      filas: [],
      totales: { notas: 0, total_usd: 0, comision_usd: 0 },
    });
    const { wb, ws } = hoja(await pedir('mes=2025-01&formato=xlsx'));
    expect(wb.SheetNames).toEqual(['enero 2025']);
    expect(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })).toEqual([
      ENCABEZADOS,
      ['TOTAL', 0, 0, 0.5, 0],
    ]);
  });

  it('T15: respeta el orden de las filas del informe', async () => {
    fetchMock.mockResolvedValue({
      ...INFORME,
      filas: [INFORME.filas[1], INFORME.filas[0]],
    });
    const { ws } = hoja(await pedir('mes=2026-11&formato=xlsx'));
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];
    expect(filas.slice(1, 3).map((f) => f[0])).toEqual(['PRAVIN', 'ANGELA']);
  });

  it('T14: un vendedor que empieza con "=" queda como texto, no como formula', async () => {
    fetchMock.mockResolvedValue({
      ...INFORME,
      filas: [{ vendedor: '=1+1', notas: 1, total_usd: 10, comision_pct: 0.5, comision_usd: 0.05 }],
    });
    const { ws } = hoja(await pedir('mes=2026-11&formato=xlsx'));
    expect(ws['A2']?.t).toBe('s');
    expect(ws['A2']?.v).toBe('=1+1');
    expect((ws['A2'] as { f?: string } | undefined)?.f).toBeUndefined();
  });
});

describe('regresion y guardas', () => {
  it('T7: sin formato sigue devolviendo el JSON de siempre', async () => {
    const res = await pedir('mes=2026-11');
    expect(res.status).toBe(200);
    expect(res.headers['Content-Disposition']).toBeUndefined();
    expect(await res.json()).toEqual(INFORME);
  });

  it.each(['pdf', '', 'XLSX'])('T8: formato %p -> 400 sin tocar la base', async (formato) => {
    const res = await pedir(`mes=2026-11&formato=${encodeURIComponent(formato)}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'formato inválido' });
    expect(pctMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T9: mes invalido con formato=xlsx -> 400 sin tocar la base', async () => {
    const res = await pedir('mes=2026-13&formato=xlsx');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'mes inválido' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T10: flag apagado -> 404 sin tocar la base', async () => {
    flags['vendedores-modulo'] = false;
    expect((await pedir('mes=2026-11&formato=xlsx')).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T11: vendedor y bodeguero -> 403 sin tocar la base', async () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      sesion('1', rol);
      expect((await pedir('mes=2026-11&formato=xlsx')).status).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T12: sin sesion -> 401', async () => {
    sesion(null);
    expect((await pedir('mes=2026-11&formato=xlsx')).status).toBe(401);
  });

  it('T13: si la base falla -> 500 JSON, loguea y no expone el error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('boom secreto'));
    const res = await pedir('mes=2026-11&formato=xlsx');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar las comisiones' });
    expect(spy).toHaveBeenCalledWith('GET /api/vendedores/comisiones error:', expect.any(Error));
    spy.mockRestore();
  });
});
