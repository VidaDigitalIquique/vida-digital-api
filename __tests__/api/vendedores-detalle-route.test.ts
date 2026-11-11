/**
 * S4a — Fase B: guardas y contrato HTTP de
 * GET /api/vendedores/notas/[empresa]/[nota] (R7).
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

jest.mock('@/lib/fechas', () => ({ hoyCL: () => '2026-11-11' }));

const flags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;

let GET: typeof import('@/app/api/vendedores/notas/[empresa]/[nota]/route').GET;

type Params = { params: { empresa: string; nota: string } };

function pedir(empresa = 'vida', nota = '002499'): [Request, Params] {
  return [
    { url: `http://localhost/api/vendedores/notas/${empresa}/${nota}` } as Request,
    { params: { empresa, nota } },
  ];
}

const CABECERA = {
  nota: '002499',
  fecha_venta: '2026-11-09',
  cliente: 'JOHN HUARACHI',
  cliente_factura: 'IMPORT EXPORT ADEEL SPA',
  vendedor: 'PRAVIN',
  total_usd: 2550,
  estado: 'facturada',
  visacion: '431033',
  fecha_visacion: '2026-11-10',
};

const LINEAS = [
  { codigo: 'HS-30', costo: '100', precio: '150', cajas: '2', unidades: '17', total_linea: '2550', imagen_url: null },
  { codigo: '303', costo: '10', precio: '20', cajas: '1', unidades: '9.075', total_linea: '181.5', imagen_url: null },
];

function sesion(rol: string | null) {
  (getServerSession as jest.Mock).mockResolvedValue(rol === null ? null : { user: { rol } });
}

beforeAll(async () => {
  const mod = await import('@/app/api/vendedores/notas/[empresa]/[nota]/route');
  GET = mod.GET;
});

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(() => Promise.resolve([]));
  flags['vendedores-modulo'] = true;
  sesion('admin');
});

afterEach(() => {
  flags['vendedores-modulo'] = true;
});

describe('guardas (401 -> 403 -> 404)', () => {
  it('sin sesion -> 401 y no toca la base', async () => {
    sesion(null);
    const res = await GET(...pedir());
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('vendedor y bodeguero -> 403', async () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      sesion(rol);
      expect((await GET(...pedir())).status).toBe(403);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('flag apagado: admin -> 404, vendedor -> 403', async () => {
    flags['vendedores-modulo'] = false;
    expect((await GET(...pedir('vida', 'no-importa'))).status).toBe(404);

    sesion('vendedor');
    expect((await GET(...pedir())).status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('validacion de parametros', () => {
  it('empresa fuera de la whitelist -> 400 sin consultar', async () => {
    expect((await GET(...pedir('foo', '002499'))).status).toBe(400);
    expect((await GET(...pedir('vida; DROP TABLE vida.movidcto', '002499'))).status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('nota invalida -> 400 sin consultar', async () => {
    for (const nota of ['abc', '', '12345678901', '1.5', '-1', ' 2514']) {
      expect((await GET(...pedir('vida', nota))).status).toBe(400);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('acepta vida, sanjh y vidadigital (whitelist existente)', async () => {
    queryMock.mockResolvedValue([]);
    for (const empresa of ['vida', 'sanjh', 'vidadigital']) {
      expect((await GET(...pedir(empresa, '002499'))).status).toBe(404);
    }
  });
});

describe('404 fuera del modulo', () => {
  it('cabecera vacia (inexistente, futura, excluida o de otra empresa) -> 404', async () => {
    queryMock.mockResolvedValueOnce([]);
    const res = await GET(...pedir('vida', '009999'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'No encontrado' });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe('respuesta 200', () => {
  it('mapea la cabecera, las lineas y la diferencia con total_linea', async () => {
    queryMock
      .mockResolvedValueOnce([CABECERA])
      .mockResolvedValueOnce(LINEAS);

    const res = await GET(...pedir('vida', '002499'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.empresa).toBe('vida');
    expect(body.empresa_nombre).toBe('Vida Digital');
    expect(body.nota).toBe('002499');
    expect(body.cliente).toBe('JOHN HUARACHI');
    expect(body.cliente_factura).toBe('IMPORT EXPORT ADEEL SPA');
    expect(body.total_usd).toBe(2550);
    expect(body.diferencia_usd).toBeCloseTo(181.5, 10);
    expect(body.lineas).toHaveLength(2);
    expect(body.lineas[0]).toEqual({
      codigo: 'HS-30',
      costo: 100,
      precio: 150,
      cajas: 2,
      unidades: 17,
      total_linea: 2550,
      imagen_url: null,
    });
  });

  it('parametros: cabecera [hoy, nota] y lineas [nota]', async () => {
    await GET(...pedir('sanjh', '003816'));
    expect(queryMock.mock.calls[0][1]).toEqual(['2026-11-11', '003816']);
  });

  it('500 si la base falla: loguea y no expone el error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('boom secreto'));
    const res = await GET(...pedir());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Error al consultar el detalle' });
    spy.mockRestore();
  });
});
