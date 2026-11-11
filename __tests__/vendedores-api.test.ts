/**
 * S2a — Fase B: guardas y contrato HTTP de /api/vendedores/notas.
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

jest.mock('@/config/feature-flags.json', () => ({ 'vendedores-modulo': true }));

const flags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;

let GET: typeof import('@/app/api/vendedores/notas/route').GET;

function req(qs = '') {
  return { url: `http://localhost/api/vendedores/notas${qs ? `?${qs}` : ''}` } as Request;
}

const FILA = {
  empresa: 'vida',
  nota: '002514',
  fecha_venta: '2026-11-09',
  cliente: 'MILENKA',
  vendedor: 'PRAVIN',
  total_usd: 825,
  estado: 'facturada',
  visacion: '431033',
  fecha_facturacion: '2026-11-10',
  total: '1',
};

beforeAll(async () => {
  const mod = await import('@/app/api/vendedores/notas/route');
  GET = mod.GET;
});

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(() => Promise.resolve([]));
  flags['vendedores-modulo'] = true;
  jest.useRealTimers();
  (getServerSession as jest.Mock).mockResolvedValue({ user: { rol: 'admin' } });
});

afterEach(() => {
  jest.useRealTimers();
  flags['vendedores-modulo'] = true;
});

describe('guardas', () => {
  it('sin sesion -> 401 y no toca la base', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('vendedor y bodeguero -> 403 y no tocan la base', async () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { rol } });
      const res = await GET(req());
      expect(res.status).toBe(403);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('flag apagado: admin -> 404, vendedor -> 403 (orden 401/403/404)', async () => {
    flags['vendedores-modulo'] = false;
    const admin = await GET(req());
    expect(admin.status).toBe(404);

    (getServerSession as jest.Mock).mockResolvedValue({ user: { rol: 'vendedor' } });
    const vendedor = await GET(req());
    expect(vendedor.status).toBe(403);

    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('validacion', () => {
  it('empresa invalida -> 400', async () => {
    const res = await GET(req('empresa=foo'));
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('fechas invalidas o invertidas -> 400', async () => {
    expect((await GET(req('desde=2026-02-30'))).status).toBe(400);
    expect((await GET(req('desde=2026-11-10&hasta=2026-11-01'))).status).toBe(400);
    expect((await GET(req('visaDesde=2026-11-10&visaHasta=2026-11-01'))).status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('visacion + pendientes -> 400', async () => {
    const res = await GET(req('visaDesde=2026-11-01&estado=pendientes'));
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('estado y limit invalidos -> 400', async () => {
    expect((await GET(req('estado=facturado'))).status).toBe(400);
    expect((await GET(req('limit=0'))).status).toBe(400);
  });
});

describe('defaults en hora de Chile', () => {
  it('sin parametros usa el mes en curso y hoy de Chile, no la fecha del proceso', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-12T02:00:00Z')); // en Chile aun es 2026-11-11

    await GET(req());

    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('2026-11-11');
    expect(params[1]).toBe('2026-11-01');
    expect(params[2]).toBe('2026-11-11');
  });
});

describe('consulta', () => {
  it('empresa=todas consulta ambos esquemas; empresa=vida no menciona sanjh', async () => {
    await GET(req('empresa=todas&desde=2026-11-01&hasta=2026-11-11'));
    const todas = String(queryMock.mock.calls[0][0]);
    expect(todas).toContain('vida.movidcto');
    expect(todas).toContain('sanjh.movidcto');

    queryMock.mockClear();
    await GET(req('empresa=vida&desde=2026-11-01&hasta=2026-11-11'));
    const vida = String(queryMock.mock.calls[0][0]);
    expect(vida).toContain('vida.movidcto');
    expect(vida).not.toContain('sanjh.');
  });

  it('reenvia vendedor, visacion y estado como parametros', async () => {
    await GET(req('vendedor=PRAVIN&visaDesde=2026-11-01&visaHasta=2026-11-30&estado=todas'));
    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe('PRAVIN');
    expect(params[4]).toBe('2026-11-01');
    expect(params[5]).toBe('2026-11-30');
    expect(params[6]).toBe('facturada');
  });

  it('solo visacion: no manda desde/hasta (null) y sigue cortando futuras', async () => {
    await GET(req('visaDesde=2026-11-01'));
    const [text, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(typeof params[0]).toBe('string');
    expect(params[1]).toBeNull();
    expect(params[2]).toBeNull();
    expect(String(text)).toContain('m.fechanvt <= $1::date');
    expect(String(text)).toContain('$2::date IS NULL');
  });

  it('limit 999 se acota a 500 y se informa en la respuesta', async () => {
    const res = await GET(req('limit=999'));
    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(params[7]).toBe(500);
    expect((await res.json()).limit).toBe(500);
  });
});

describe('respuesta con datos', () => {
  it('mapea notas, total y vendedores', async () => {
    queryMock.mockImplementation((text: string) => {
      if (text.includes('DISTINCT')) return Promise.resolve([{ vendedor: 'PRAVIN' }]);
      return Promise.resolve([FILA]);
    });

    const res = await GET(req('desde=2026-11-01&hasta=2026-11-11'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      notas: [
        {
          empresa: 'vida',
          empresa_nombre: 'Vida Digital',
          fecha_venta: '2026-11-09',
          nota: '002514',
          cliente: 'MILENKA',
          vendedor: 'PRAVIN',
          total_usd: 825,
          estado: 'facturada',
          visacion: '431033',
          fecha_facturacion: '2026-11-10',
        },
      ],
      vendedores: ['PRAVIN'],
      total: 1,
      limit: 300,
    });
  });

  it('500 si la base falla: loguea el error y no lo expone', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('boom secreto'));
    const res = await GET(req());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Error al consultar notas' });
    expect(spy).toHaveBeenCalledWith('GET /api/vendedores/notas error:', expect.any(Error));
    spy.mockRestore();
  });
});
