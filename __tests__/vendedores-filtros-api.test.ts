/**
 * S3 — Fase B: guardas y contrato HTTP de /api/vendedores/filtros (R6).
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

let GET: typeof import('@/app/api/vendedores/filtros/route').GET;
let PUT: typeof import('@/app/api/vendedores/filtros/route').PUT;

const VALIDO = {
  vendedor: 'PRAVIN',
  desde: '2026-11-01',
  hasta: '2026-11-11',
  visaDesde: '',
  visaHasta: '',
  estado: 'todas',
  empresa: 'todas',
};

const FILA = { filtros: VALIDO };

function pedir(body: unknown) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

function pedirJsonRoto() {
  return {
    json: () => Promise.reject(new Error('bad json')),
  } as unknown as Request;
}

function sesion(id: string | null, rol = 'admin') {
  (getServerSession as jest.Mock).mockResolvedValue(
    id === null ? { user: { rol } } : { user: { rol, id } }
  );
}

beforeAll(async () => {
  const mod = await import('@/app/api/vendedores/filtros/route');
  GET = mod.GET;
  PUT = mod.PUT;
});

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(() => Promise.resolve([]));
  flags['vendedores-modulo'] = true;
  sesion('1');
});

afterEach(() => {
  flags['vendedores-modulo'] = true;
});

describe('guardas (401 -> 403 -> 404)', () => {
  it('sin sesion -> 401 y no toca la base', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PUT(pedir(VALIDO))).status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('vendedor y bodeguero -> 403 y no tocan la base', async () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      sesion('1', rol);
      expect((await GET()).status).toBe(403);
      expect((await PUT(pedir(VALIDO))).status).toBe(403);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('flag apagado: admin -> 404, vendedor -> 403 (el rol se evalua antes)', async () => {
    flags['vendedores-modulo'] = false;
    expect((await GET()).status).toBe(404);
    expect((await PUT(pedir(VALIDO))).status).toBe(404);
    sesion('1', 'vendedor');
    expect((await GET()).status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('sesion admin sin id valido -> 401 y no toca la base', async () => {
    sesion(null);
    expect((await GET()).status).toBe(401);
    sesion('abc');
    expect((await PUT(pedir(VALIDO))).status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('sin fila guardada -> { filtros: null }', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ filtros: null });
  });

  it('devuelve los filtros del usuario de la sesion', async () => {
    queryMock.mockResolvedValue([FILA]);
    const res = await GET();
    await expect(res.json()).resolves.toEqual({ filtros: VALIDO });
    const [text, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(String(text)).toContain('public.vendedores_filtros');
    expect(params).toEqual([1]);
  });

  it('dos usuarios distintos leen cada uno lo suyo', async () => {
    await GET();
    expect((queryMock.mock.calls[0] as [string, unknown[]])[1]).toEqual([1]);

    queryMock.mockClear();
    sesion('2');
    queryMock.mockResolvedValue([{ filtros: { ...VALIDO, vendedor: 'ANGELA' } }]);
    const res = await GET();
    expect((queryMock.mock.calls[0] as [string, unknown[]])[1]).toEqual([2]);
    await expect(res.json()).resolves.toMatchObject({ filtros: { vendedor: 'ANGELA' } });
  });

  it('jsonb devuelto como texto se normaliza; basura -> null', async () => {
    queryMock.mockResolvedValueOnce([{ filtros: JSON.stringify(VALIDO) }]);
    await expect((await GET()).json()).resolves.toEqual({ filtros: VALIDO });
    queryMock.mockResolvedValueOnce([{ filtros: '{no-json' }]);
    await expect((await GET()).json()).resolves.toEqual({ filtros: null });
  });

  it('500 si la base falla: loguea y no expone el error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('boom secreto'));
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Error al leer los filtros' });
    expect(spy).toHaveBeenCalledWith('GET /api/vendedores/filtros error:', expect.any(Error));
    spy.mockRestore();
  });
});

describe('PUT', () => {
  it('UPSERT del usuario de la sesion (nunca del body)', async () => {
    queryMock.mockResolvedValue([FILA]);
    const res = await PUT(pedir({ ...VALIDO, vendedor: '  PRAVIN  ' }));
    expect(res.status).toBe(200);
    const [text, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(String(text)).toContain('ON CONFLICT (usuario_id) DO UPDATE');
    expect(String(text)).toContain('RETURNING filtros');
    expect(params[0]).toBe(1);
    expect(JSON.parse(String(params[1]))).toEqual(VALIDO);
  });

  it('otro usuario escribe con su propio id', async () => {
    sesion('2');
    await PUT(pedir(VALIDO));
    expect((queryMock.mock.calls[0] as [string, unknown[]])[1][0]).toBe(2);
  });

  it('usuario_id en el body -> 400 por clave desconocida, sin tocar la base', async () => {
    const res = await PUT(pedir({ ...VALIDO, usuario_id: 999 }));
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('doble PUT usa el mismo usuario: sin duplicados (la base decide por la PK)', async () => {
    queryMock.mockResolvedValue([FILA]);
    await PUT(pedir(VALIDO));
    await PUT(pedir({ ...VALIDO, estado: 'pendientes' }));
    const ids = queryMock.mock.calls.map((c) => (c[1] as unknown[])[0]);
    expect(ids).toEqual([1, 1]);
  });

  it('JSON roto, null, array, claves extra, valores invalidos y rangos invertidos -> 400 sin base', async () => {
    const casos: unknown[] = [
      null,
      [],
      'texto',
      { ...VALIDO, usuario_id: 1 },
      { ...VALIDO, desde: 20261101 },
      { ...VALIDO, desde: '2026-02-30' },
      { ...VALIDO, desde: '0002-11-11' },
      { ...VALIDO, desde: '2026-11-10', hasta: '2026-11-01' },
      { ...VALIDO, visaDesde: '2026-11-10', visaHasta: '2026-11-01' },
      { ...VALIDO, visaDesde: '2026-11-01', estado: 'pendientes' },
      { ...VALIDO, estado: 'facturado' },
      { ...VALIDO, empresa: 'foo' },
      { ...VALIDO, vendedor: 'X'.repeat(101) },
    ];
    for (const body of casos) {
      expect((await PUT(pedir(body))).status).toBe(400);
    }
    expect((await PUT(pedirJsonRoto())).status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('500 si la base falla al guardar', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('boom secreto'));
    const res = await PUT(pedir(VALIDO));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Error al guardar los filtros' });
    expect(spy).toHaveBeenCalledWith('PUT /api/vendedores/filtros error:', expect.any(Error));
    spy.mockRestore();
  });
});
