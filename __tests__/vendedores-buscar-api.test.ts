/**
 * S15a — Fase B: guardas y contrato HTTP de /api/vendedores/buscar.
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

jest.mock('@/config/feature-flags.json', () => ({ 'vendedores-buscador': true }));

const flags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;

let GET: typeof import('@/app/api/vendedores/buscar/route').GET;

function req(qs = '') {
  return { url: `http://localhost/api/vendedores/buscar${qs ? `?${qs}` : ''}` } as Request;
}

const FILA = {
  empresa: 'vida',
  nota: '002578',
  fecha_venta: '2026-11-20',
  cliente: 'ANGELA',
  vendedor: 'PRAVIN',
  total_usd: 825,
  estado: 'facturada',
  visacion: '431033',
  fecha_facturacion: '2026-11-21',
};

beforeAll(async () => {
  const mod = await import('@/app/api/vendedores/buscar/route');
  GET = mod.GET;
});

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(() => Promise.resolve([]));
  flags['vendedores-buscador'] = true;
  (getServerSession as jest.Mock).mockResolvedValue({ user: { rol: 'admin' } });
});

afterEach(() => {
  flags['vendedores-buscador'] = true;
});

describe('guardas (401 -> 403 -> 404)', () => {
  it('sin sesion -> 401 y no toca la base', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(req('q=25'));
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('bodeguero -> 403 y no toca la base', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { rol: 'bodeguero' } });
    const res = await GET(req('q=25'));
    expect(res.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('flag apagado -> 404 (admin y vendedor) y no toca la base', async () => {
    flags['vendedores-buscador'] = false;
    expect((await GET(req('q=25'))).status).toBe(404);

    (getServerSession as jest.Mock).mockResolvedValue({ user: { rol: 'vendedor' } });
    expect((await GET(req('q=25'))).status).toBe(404);

    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('q demasiado corta', () => {
  it.each([
    ['sin q', ''],
    ['q vacia', 'q='],
    ['1 caracter', 'q=a'],
    ['solo espacios', 'q=%20%20%20'],
  ])('%s -> 200 {notas:[]} sin llamar a la base', async (_nombre, qs) => {
    const res = await GET(req(qs));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ notas: [] });
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('200', () => {
  it('admin: busca en ambos esquemas y mapea empresa_nombre', async () => {
    queryMock.mockResolvedValue([FILA]);
    const res = await GET(req('q=25'));
    expect(res.status).toBe(200);

    const [text, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(String(text)).toContain('vida.movidcto');
    expect(String(text)).toContain('sanjh.movidcto');
    expect(params[1]).toBe('25');
    expect(params[2]).toBe('25');

    const body = await res.json();
    expect(body.notas).toHaveLength(1);
    expect(body.notas[0]).toMatchObject({
      empresa: 'vida',
      empresa_nombre: 'Vida Digital',
      nota: '002578',
    });
  });

  it('vendedor: 200 y sin claves costo/ganancia/precio', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { rol: 'vendedor' } });
    queryMock.mockResolvedValue([FILA]);
    const res = await GET(req('q=25'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notas).toHaveLength(1);
    for (const clave of ['costo', 'ganancia', 'precio']) {
      expect(body.notas[0]).not.toHaveProperty(clave);
    }
  });
});

describe('errores', () => {
  it('500 generico si la base falla; no expone el detalle', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('boom secreto'));
    const res = await GET(req('q=25'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Error al consultar notas' });
    expect(JSON.stringify(body)).not.toContain('boom secreto');
    spy.mockRestore();
  });
});
