/**
 * S5a/S5b — Fase B: guardas y contrato HTTP de /api/vendedores/comisiones (R8, R9).
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
let PUT: typeof import('@/app/api/vendedores/comisiones/route').PUT;

function req(qs = '') {
  return { url: `http://localhost/api/vendedores/comisiones${qs ? `?${qs}` : ''}` } as Request;
}

function pedir(body: unknown) {
  return { json: () => Promise.resolve(body) } as unknown as Request;
}

function pedirJsonRoto() {
  return { json: () => Promise.reject(new Error('bad json')) } as unknown as Request;
}

function sesion(id: string | null, rol = 'admin') {
  (getServerSession as jest.Mock).mockResolvedValue(
    id === null ? { user: { rol } } : { user: { rol, id } }
  );
}

function mockDb() {
  queryMock.mockImplementation((text: unknown, params?: unknown[]) => {
    const t = String(text);
    if (t.includes('public.vendedores_config')) {
      // UPSERT: devuelve lo guardado; SELECT: el valor actual.
      return Promise.resolve([{ pct: t.includes('ON CONFLICT') ? (params ?? [])[0] : 0.5 }]);
    }
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
  PUT = mod.PUT;
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

  it('PUT: mismas guardas 401 -> 403 -> 404 y no toca la base', async () => {
    const body = { mes: '2026-11', comision_pct: 1 };
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await PUT(pedir(body))).status).toBe(401);

    sesion('1', 'vendedor');
    expect((await PUT(pedir(body))).status).toBe(403);

    sesion('1');
    flags['vendedores-modulo'] = false;
    expect((await PUT(pedir(body))).status).toBe(404);

    flags['vendedores-modulo'] = true;
    sesion(null); // admin sin id: updated_by no se puede resolver
    expect((await PUT(pedir(body))).status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
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

describe('PUT — guardar el % (R9)', () => {
  const VALIDO = { mes: '2026-11', comision_pct: 1 };

  it('UPSERT de la fila unica id=1 con el id de la sesion y devuelve el informe recalculado', async () => {
    const res = await PUT(pedir({ ...VALIDO, comision_pct: 2 }));
    expect(res.status).toBe(200);

    const upsert = queryMock.mock.calls.find((c) => String(c[0]).includes('ON CONFLICT')) as [
      string,
      unknown[],
    ];
    expect(String(upsert[0])).toContain('INSERT INTO public.vendedores_config');
    expect(String(upsert[0])).toContain('ON CONFLICT (id) DO UPDATE');
    expect(upsert[0]).not.toContain('$3'); // el id es fijo, nunca viene del body
    expect(upsert[1]).toEqual([2, 1]); // [pct, usuarioId]

    const body = await res.json();
    expect(body.mes).toBe('2026-11');
    expect(body.comision_pct).toBe(2);
    expect(body.filas[0]).toMatchObject({ vendedor: 'ANGELA', comision_pct: 2, comision_usd: 219.6 });
    expect(body.totales.comision_usd).toBe(219.6);
  });

  it('sin mes usa el mes en curso de Chile', async () => {
    const body = await (await PUT(pedir({ comision_pct: 1 }))).json();
    expect(body.mes).toBe('2026-11');
  });

  it('el % viaja como numero a la base (sin el body del cliente)', async () => {
    await PUT(pedir({ mes: '2026-10', comision_pct: 0.5 }));
    const upsert = queryMock.mock.calls.find((c) => String(c[0]).includes('ON CONFLICT')) as [
      string,
      unknown[],
    ];
    expect(upsert[1][0]).toBe(0.5);
  });

  it('doble PUT: siempre la misma fila (id fijo 1), sin insertar una segunda', async () => {
    await PUT(pedir({ ...VALIDO, comision_pct: 1 }));
    await PUT(pedir({ ...VALIDO, comision_pct: 1.5 }));
    const upserts = queryMock.mock.calls.filter((c) => String(c[0]).includes('ON CONFLICT'));
    expect(upserts).toHaveLength(2);
    for (const c of upserts) {
      expect(String(c[0])).toContain('INSERT INTO public.vendedores_config (id, comision_pct');
      expect((c[1] as unknown[])[1]).toBe(1);
    }
  });

  it.each([-1, 100.01, 101, 0.555, '0.5', null, true, {}, []])(
    'porcentaje invalido %p -> 400 sin tocar la base',
    async (pct) => {
      expect((await PUT(pedir({ ...VALIDO, comision_pct: pct }))).status).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    }
  );

  it.each(['2026-13', '26-11', '', 202611])('mes invalido %p -> 400 sin tocar la base', async (mes) => {
    expect((await PUT(pedir({ mes, comision_pct: 1 }))).status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('body invalido (null, array, texto, JSON roto) -> 400 sin tocar la base', async () => {
    for (const body of [null, [], 'texto', 42]) {
      expect((await PUT(pedir(body))).status).toBe(400);
    }
    expect((await PUT(pedirJsonRoto())).status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('500 si la base falla al guardar: loguea y no expone el error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('boom secreto'));
    const res = await PUT(pedir(VALIDO));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Error al guardar las comisiones' });
    expect(spy).toHaveBeenCalledWith('PUT /api/vendedores/comisiones error:', expect.any(Error));
    spy.mockRestore();
  });
});
