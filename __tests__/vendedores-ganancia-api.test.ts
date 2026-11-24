/**
 * S7c-1 — Fase B: guardas y contrato HTTP de GET /api/vendedores/ganancia (B10–B19).
 * Estado inicial: ROJO (la ruta aun no existe).
 */
import { getServerSession } from 'next-auth';

const queryMock = jest.fn();

jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/config/feature-flags.json', () => ({ 'vendedores-ganancia-periodo': true }));

jest.mock('@/lib/fechas', () => ({ hoyCL: () => '2026-11-24' }));

const flags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;

let GET: typeof import('@/app/api/vendedores/ganancia/route').GET;

function pedir(query = ''): Request {
  return { url: `http://localhost/api/vendedores/ganancia${query}` } as Request;
}

function sesion(rol: string | null) {
  (getServerSession as jest.Mock).mockResolvedValue(rol === null ? null : { user: { rol } });
}

beforeAll(async () => {
  const mod = await import('@/app/api/vendedores/ganancia/route');
  GET = mod.GET;
});

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(() => Promise.resolve([]));
  flags['vendedores-ganancia-periodo'] = true;
  sesion('admin');
});

afterEach(() => {
  flags['vendedores-ganancia-periodo'] = true;
  jest.restoreAllMocks();
});

describe('guardas (401 -> 403 -> 404)', () => {
  it('B10 sin sesion -> 401 y no toca la base', async () => {
    sesion(null);
    const res = await GET(pedir());
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('B11 vendedor y bodeguero -> 403 sin base', async () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      sesion(rol);
      const res = await GET(pedir());
      expect(res.status).toBe(403);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('B12 flag apagada -> 404 para admin; el rol se valida antes que la flag', async () => {
    flags['vendedores-ganancia-periodo'] = false;
    expect((await GET(pedir())).status).toBe(404);
    sesion('vendedor');
    expect((await GET(pedir())).status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('validacion de parametros', () => {
  it('B13 agrupar invalido -> 400 sin base', async () => {
    for (const q of ['?agrupar=years', '?agrupar=']) {
      const res = await GET(pedir(q));
      expect(res.status).toBe(400);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('B14 fecha invalida -> 400 sin base', async () => {
    for (const q of ['?desde=2026-13-01', '?desde=2026-1-1', '?desde=', '?hasta=2026-02-30']) {
      const res = await GET(pedir(q));
      expect(res.status).toBe(400);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('B15 rango invertido -> 400 sin base', async () => {
    const res = await GET(pedir('?desde=2026-11-24&hasta=2026-11-01'));
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('B16 estado invalido -> 400 sin base', async () => {
    const res = await GET(pedir('?estado=pagadas'));
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('contrato', () => {
  it('B17 sin params usa defaults del servidor y consulta ambas empresas', async () => {
    const res = await GET(pedir());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      agrupacion: 'dia',
      desde: '2026-11-01',
      hasta: '2026-11-24',
      estado: 'facturadas', // S8: el estado por defecto es Facturadas
      filas: [],
      truncado: false,
    });
    expect(queryMock).toHaveBeenCalledTimes(2);
    const esquemas = queryMock.mock.calls.map(([text]) => (String(text).includes('vida.movidcto') ? 'vida' : 'sanjh'));
    expect(esquemas.sort()).toEqual(['sanjh', 'vida']);
    for (const [, params] of queryMock.mock.calls) expect(params[3]).toBe('facturada');
  });

  it('S8 sin ?estado= el SQL recibe facturada, no NULL', async () => {
    await GET(pedir('?agrupar=mes'));
    expect(queryMock.mock.calls.length).toBe(2);
    for (const [, params] of queryMock.mock.calls) expect(params[3]).toBe('facturada');
  });

  it('B18 estado facturadas viaja como facturada en $4 y las fechas en $2/$3', async () => {
    await GET(pedir('?agrupar=mes&desde=2026-09-01&hasta=2026-11-24&estado=facturadas'));
    for (const [, params] of queryMock.mock.calls) {
      expect(params).toEqual(['2026-11-24', '2026-09-01', '2026-11-24', 'facturada']);
    }
  });

  it('B19 fallo de la base -> 500 generico y log del error real', async () => {
    const err = new Error('neon timeout');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockImplementation(() => Promise.reject(err));
    const res = await GET(pedir());
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toContain('neon');
    expect(spy).toHaveBeenCalledWith('GET /api/vendedores/ganancia error:', err);
  });
});
