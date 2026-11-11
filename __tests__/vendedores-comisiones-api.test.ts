/**
 * S5a — Fase B: guardas y contrato HTTP de GET /api/vendedores/comisiones (R8).
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

jest.mock('@/lib/fechas', () => ({ hoyCL: jest.fn(() => '2026-11-11') }));

const flags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;

let GET: typeof import('@/app/api/vendedores/comisiones/route').GET;

function req(qs = '') {
  return { url: `http://localhost/api/vendedores/comisiones${qs ? `?${qs}` : ''}` } as Request;
}

function sesion(id: string | null, rol = 'admin') {
  (getServerSession as jest.Mock).mockResolvedValue(
    id === null ? { user: { rol } } : { user: { rol, id } }
  );
}

function mockDb() {
  queryMock.mockImplementation((text: unknown) => {
    const t = String(text);
    if (t.includes('public.vendedores_config')) return Promise.resolve([{ pct: 0.5 }]);
    if (t.includes('DISTINCT')) {
      return Promise.resolve(
        t.includes('sanjh.movidcto')
          ? [{ vendedor: 'JOSEPH LEVANO' }]
          : [{ vendedor: 'ANGELA' }, { vendedor: 'PRAVIN' }]
      );
    }
    if (t.includes('sanjh.movidcto')) return Promise.resolve([]);
    return Promise.resolve([{ vendedor: 'ANGELA', notas: 2, total_usd: 10980.1 }]);
  });
}

beforeAll(async () => {
  const mod = await import('@/app/api/vendedores/comisiones/route');
  GET = mod.GET;
});

beforeEach(() => {
  queryMock.mockReset();
  mockDb();
  flags['vendedores-modulo'] = true;
  sesion('1');
});

describe('guardas (401 -> 403 -> 404)', () => {
  it('sin sesion -> 401 y no toca la base', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('vendedor y bodeguero -> 403 y no tocan la base', async () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      sesion('1', rol);
      expect((await GET(req())).status).toBe(403);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('flag apagado: admin -> 404; vendedor -> 403 (el rol se evalua antes)', async () => {
    flags['vendedores-modulo'] = false;
    expect((await GET(req())).status).toBe(404);
    sesion('1', 'vendedor');
    expect((await GET(req())).status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('admin sin id valido -> 401 y no toca la base', async () => {
    sesion(null);
    expect((await GET(req())).status).toBe(401);
  });
});

describe('contrato del informe', () => {
  it('sin mes -> mes en curso de Chile (hoyCL), filas y totales ya calculados', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mes).toBe('2026-11');
    expect(body.mes_etiqueta).toBe('noviembre 2026');
    expect(body.comision_pct).toBe(0.5);
    expect(body.filas.map((f: { vendedor: string }) => f.vendedor)).toEqual([
      'ANGELA',
      'JOSEPH LEVANO',
      'PRAVIN',
    ]);
    expect(body.filas[0]).toEqual({
      vendedor: 'ANGELA',
      notas: 2,
      total_usd: 10980.1,
      comision_pct: 0.5,
      comision_usd: 54.9,
    });
    expect(body.totales).toEqual({ notas: 2, total_usd: 10980.1, comision_usd: 54.9 });
  });

  it('el rango del mes viaja a las consultas de agregacion', async () => {
    await GET(req('mes=2026-10'));
    const llamada = queryMock.mock.calls.find(
      (c) => String(c[0]).includes('GROUP BY') && String(c[0]).includes('vida.movidcto')
    ) as [string, unknown[]];
    expect(llamada[1]).toEqual(['2026-11-11', '2026-10-01', '2026-11-01']);
  });

  it('el default no depende de la TZ del proceso: usa el mes de hoyCL', async () => {
    const fechas = jest.requireMock('@/lib/fechas') as { hoyCL: jest.Mock };
    fechas.hoyCL.mockReturnValueOnce('2026-12-01');
    const body = await (await GET(req())).json();
    expect(body.mes).toBe('2026-12');
  });

  it.each(['2026-13', '26-11', '2026-1', '1999-12', '2101-01', ''])(
    'mes invalido %p -> 400 sin tocar la base',
    async (mes) => {
      expect((await GET(req(`mes=${encodeURIComponent(mes)}`))).status).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    }
  );

  it('500 si la base falla: loguea y no expone el error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('boom secreto'));
    const res = await GET(req());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Error al consultar las comisiones' });
    expect(spy).toHaveBeenCalledWith('GET /api/vendedores/comisiones error:', expect.any(Error));
    spy.mockRestore();
  });
});
