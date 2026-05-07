/**
 * @jest-environment node
 */

const sql = jest.fn();
const getServerSession = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession,
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

const HOY = '2026-05-07';

function buildDespacho(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, folio: 'F100', imagen_url: null, empresa_id: 1,
    created_at: `${HOY}T10:30:00-04:00`,
    ...overrides,
  };
}

describe('GET /api/dashboard/despachos', () => {
  let GET: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-07T12:00:00-04:00'));
    const mod = await import('@/app/api/dashboard/despachos/route');
    GET = mod.GET;
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    sql.mockReset();
    getServerSession.mockResolvedValue({
      user: { id: 1, empresas: [1, 2] },
    });
  });

  function makeReq(empresaIds: number[]) {
    const params = new URLSearchParams();
    empresaIds.forEach(id => params.append('empresaId', String(id)));
    return new Request(`http://localhost/api/dashboard/despachos?${params}`);
  }

  test('retorna 6 columnas desde hoy hacia atrás', async () => {
    sql.mockResolvedValueOnce([buildDespacho()]);

    const res = await GET(makeReq([1]));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.columnas).toHaveLength(6);
    expect(body.columnas[0].fecha).toBe(HOY);
    expect(body.columnas[0].despachos).toHaveLength(1);
    expect(body.columnas[0].despachos[0].folio).toBe('F100');
  });

  test('días sin despachos retornan array vacío', async () => {
    sql.mockResolvedValueOnce([buildDespacho()]);

    const res = await GET(makeReq([1]));
    const body = await res.json();

    const sinDespachos = body.columnas.slice(1);
    expect(sinDespachos.every((c: any) => c.despachos.length === 0)).toBe(true);
  });

  test('agrupa múltiples despachos del mismo día en la misma columna', async () => {
    sql.mockResolvedValueOnce([
      buildDespacho({ id: 2, folio: 'F2', created_at: `${HOY}T14:00:00-04:00` }),
      buildDespacho({ id: 1, folio: 'F1', created_at: `${HOY}T09:00:00-04:00` }),
    ]);

    const res = await GET(makeReq([1]));
    const body = await res.json();

    const hoy = body.columnas[0];
    expect(hoy.despachos).toHaveLength(2);
    expect(hoy.despachos.map((d: any) => d.folio)).toEqual(['F2', 'F1']);
  });
});
