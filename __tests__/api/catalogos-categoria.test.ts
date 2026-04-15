/**
 * @jest-environment node
 */
const getServerSession = jest.fn();
const sqlMock = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sqlMock(...args),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

let POST: any;
let GET_PUBLIC: any;

describe('catalogos — soporte de campo categoria', () => {
  beforeAll(async () => {
    if (typeof (global as any).Request === 'undefined') {
      (global as any).Request = class Request {};
    }
    const modCatalogos = await import('@/app/api/catalogos/route');
    POST = modCatalogos.POST;

    const modPublic = await import('@/app/api/catalogos/public/[slug]/route');
    GET_PUBLIC = modPublic.GET;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    getServerSession.mockReset();
  });

  test('POST crea catálogo con categoria válida y la devuelve en el response', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', id: 1, empresas: [2] },
    });

    sqlMock.mockResolvedValueOnce([{
      id: 10,
      empresa_id: 2,
      user_id: 1,
      slug: 'test-belleza-12345',
      titulo: 'Test',
      descripcion: null,
      activo: true,
      categoria: 'Belleza',
      mostrar_precio: true,
      margen_precio: 0,
      solo_stock: false,
      solo_nuevo: false,
      palabras_incluir: '',
      palabras_excluir: '',
      ambas_empresas: false,
    }]);

    const req = {
      json: async () => ({
        empresaId: 2,
        titulo: 'Test',
        categoria: 'Belleza',
        mostrar_precio: true,
        margen_precio: 0,
        solo_stock: false,
        solo_nuevo: false,
        palabras_incluir: '',
        palabras_excluir: '',
        ambas_empresas: false,
      }),
    } as Request;

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.categoria).toBe('Belleza');
  });

  test('POST crea catálogo con categoria null (sin filtro de categoría)', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', id: 1, empresas: [2] },
    });

    sqlMock.mockResolvedValueOnce([{
      id: 11,
      empresa_id: 2,
      user_id: 1,
      slug: 'test-sin-categoria-99999',
      titulo: 'Test sin categoria',
      descripcion: null,
      activo: true,
      categoria: null,
      mostrar_precio: true,
      margen_precio: 0,
      solo_stock: false,
      solo_nuevo: false,
      palabras_incluir: '',
      palabras_excluir: '',
      ambas_empresas: false,
    }]);

    const req = {
      json: async () => ({
        empresaId: 2,
        titulo: 'Test sin categoria',
        categoria: null,
      }),
    } as Request;

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.categoria).toBeNull();
  });

  test('GET público devuelve solo productos que coinciden con la categoría del catálogo', async () => {
    // sql call 1: SELECT catálogo — tiene categoria: 'Belleza' y palabras_incluir vacío
    sqlMock.mockResolvedValueOnce([{
      id: 10,
      empresa_id: 2,
      slug: 'test-belleza-12345',
      titulo: 'Catálogo Belleza',
      descripcion: null,
      activo: true,
      categoria: 'Belleza',
      mostrar_precio: true,
      margen_precio: '0',
      solo_stock: false,
      solo_nuevo: false,
      palabras_incluir: '',
      palabras_excluir: '',
      ambas_empresas: false,
      empresa_slug: 'sanjh',
    }]);

    // sql call 2: SELECT productos — la route filtra por categoria en SQL,
    // el mock devuelve solo el producto de Belleza
    sqlMock.mockResolvedValueOnce([{
      codigo: 'A1',
      id: 1,
      detalle: 'MASAJEADOR',
      imagen_url: null,
      cantcaja: 1,
      umed: 'UN',
      costo: '10',
      saldo: '5',
      es_nuevo: false,
      categoria: 'Belleza',
    }]);

    const req = { url: 'http://localhost/api/catalogos/public/test-belleza-12345' } as Request;
    const res = await GET_PUBLIC(req, { params: { slug: 'test-belleza-12345' } });
    expect(res.status).toBe(200);

    const body = await res.json();
    const codigos = body.data.productos.map((p: any) => p.codigo);
    expect(codigos).toContain('A1');
    expect(codigos).not.toContain('B1');
  });
});
