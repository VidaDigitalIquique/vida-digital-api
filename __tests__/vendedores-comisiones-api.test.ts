/**
 * S5a/S5b — Fase B: guardas y contrato HTTP de /api/vendedores/comisiones (R8, R9).
 */
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';

const queryMock = jest.fn();

jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('next/server', () => {
  class NextResponse {
    status: number;
    headers: Record<string, string>;
    private _body: unknown;
    constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body;
      this.status = init?.status ?? 200;
      this.headers = init?.headers ?? {};
    }
    async json() {
      return this._body;
    }
    static json(body: unknown, init?: { status?: number }) {
      return new NextResponse(body, init);
    }
  }
  return { NextResponse };
});

jest.mock('@/config/feature-flags.json', () => ({
  'vendedores-modulo': true,
  'vendedores-comisiones-margen': false,
}));

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
    if (t.includes('precread')) {
      return Promise.resolve(
        t.includes('sanjh.movidcto')
          ? []
          : [{ vendedor: 'ANGELA', suma_pct: 90, n_lineas: 3 }] // 10 + 20 + 60 -> 30 %
      );
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
  flags['vendedores-comisiones-margen'] = false;
  sesion('1');
});

describe('guardas (401 -> 403 -> 404)', () => {
  it('sin sesion -> 401 y no toca la base', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('bodeguero -> 403 y no toca la base', async () => {
    sesion('1', 'bodeguero');
    expect((await GET(req())).status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('vendedor -> GET 200 y xlsx 200 (s14a: ve las comisiones)', async () => {
    sesion('1', 'vendedor');
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).comision_pct).toBe(0.5);

    const xlsx = await GET(req('formato=xlsx'));
    expect(xlsx.status).toBe(200);
    expect((xlsx.headers as unknown as Record<string, string>)['Content-Type']).toContain('spreadsheetml');
  });

  it('flag apagado: admin y vendedor -> 404; bodeguero -> 403 (el rol se evalua antes)', async () => {
    flags['vendedores-modulo'] = false;
    expect((await GET(req())).status).toBe(404);
    sesion('1', 'vendedor');
    expect((await GET(req())).status).toBe(404);
    sesion('1', 'bodeguero');
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

  it('PUT vendedor -> 403 sin leer el body ni tocar la base (C1: % global solo admin)', async () => {
    sesion('1', 'vendedor');
    const jsonSpy = jest.fn();
    const res = await PUT({ json: jsonSpy } as unknown as Request);
    expect(res.status).toBe(403);
    expect(jsonSpy).not.toHaveBeenCalled();
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

describe('columna % promedio sobre el costo (s17: promedio simple por linea)', () => {
  const llamadasMargen = () =>
    queryMock.mock.calls.filter((c) => String(c[0]).includes('precread'));

  it('admin con el flag encendido: promedio simple de las lineas en filas y totales', async () => {
    flags['vendedores-comisiones-margen'] = true;
    const body = await (await GET(req())).json();
    const angela = body.filas.find((f: { vendedor: string }) => f.vendedor === 'ANGELA');
    expect(angela.margen_pct).toBeCloseTo(90 / 3, 10); // 30 %, no 18,8235 % ponderado
    expect(body.filas.find((f: { vendedor: string }) => f.vendedor === 'PRAVIN').margen_pct).toBeNull();
    expect(body.totales.margen_pct).toBeCloseTo(30, 10);
    expect(llamadasMargen()).toHaveLength(2); // vida + sanjh
  });

  it('flag apagado: sin la clave y sin consultar el margen', async () => {
    const body = await (await GET(req())).json();
    expect(body.filas.every((f: object) => !('margen_pct' in f))).toBe(true);
    expect('margen_pct' in body.totales).toBe(false);
    expect(llamadasMargen()).toHaveLength(0);
  });

  it('vendedor con el flag encendido: sin margen y sin consultar el margen (solo admin)', async () => {
    flags['vendedores-comisiones-margen'] = true;
    sesion('1', 'vendedor');
    const body = await (await GET(req())).json();
    expect(body.filas.every((f: object) => !('margen_pct' in f))).toBe(true);
    expect('margen_pct' in body.totales).toBe(false);
    expect(llamadasMargen()).toHaveLength(0);
  });

  it('PUT admin con el flag encendido devuelve el informe con margen', async () => {
    flags['vendedores-comisiones-margen'] = true;
    const body = await (await PUT(pedir({ mes: '2026-11', comision_pct: 1 }))).json();
    expect(body.filas[0].margen_pct).toBeCloseTo(30, 10);
  });

  it('xlsx de vendedor: 5 columnas, sin la de margen', async () => {
    sesion('1', 'vendedor');
    const res = await GET(req('formato=xlsx'));
    const wb = XLSX.read((res as unknown as { _body: Buffer })._body, { type: 'buffer' });
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];
    expect(filas[0]).toHaveLength(5);
    expect(filas[0]).not.toContain('% promedio sobre el costo');
  });

  it('xlsx de admin con el flag encendido: 6 columnas y el margen al final', async () => {
    flags['vendedores-comisiones-margen'] = true;
    const res = await GET(req('formato=xlsx'));
    const wb = XLSX.read((res as unknown as { _body: Buffer })._body, { type: 'buffer', cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    expect(filas[0]).toHaveLength(6);
    expect(filas[0][5]).toBe('% promedio sobre el costo');
    expect(ws['F2'].t).toBe('n');
    expect(ws['F2'].z).toBe('0.0"%"');
    expect(ws['F2'].v).toBeCloseTo(30, 8);
    expect(ws['F3'].v).toBe('-'); // PRAVIN sin lineas de costo
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
