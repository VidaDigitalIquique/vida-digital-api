/**
 * @jest-environment node
 */

const sql = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

const CATALOGO_BASE = {
  id: 1, slug: 'test', titulo: 'Test', descripcion: null,
  activo: true, mostrar_precio: false, margen_precio: 0,
  solo_stock: false, solo_nuevo: false,
  palabras_incluir: '', palabras_excluir: '',
  ambas_empresas: true, empresa_id: 2, categoria: null,
  empresa_slug: 'vida-digital',
};

const PRODUCTOS = [
  { codigo: 'A1', id: 1, detalle: 'Producto con stock',  imagen_url: null, cantcaja: 1, umed: null, costo: 100, saldo: 5, es_nuevo: false },
  { codigo: 'A2', id: 2, detalle: 'Producto sin stock',  imagen_url: null, cantcaja: 1, umed: null, costo: 100, saldo: 0, es_nuevo: false },
  { codigo: 'A3', id: 3, detalle: 'Producto nuevo',      imagen_url: null, cantcaja: 1, umed: null, costo: 100, saldo: 3, es_nuevo: true  },
];

describe('GET /api/catalogos/public/[slug] — filtros solo_stock / solo_nuevo', () => {
  let GET: (req: Request, ctx: { params: { slug: string } }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/catalogos/public/[slug]/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    sql.mockReset();
  });

  const makeReq = (slug: string) =>
    new Request(`http://localhost/api/catalogos/public/${slug}`);

  test('1 — sin filtros activos retorna todos los productos (3)', async () => {
    sql
      .mockResolvedValueOnce([CATALOGO_BASE])
      .mockResolvedValueOnce(PRODUCTOS);

    const res = await GET(makeReq('test'), { params: { slug: 'test' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.productos.length).toBe(3);
  });

  test('2 — solo_stock=true retorna solo productos con saldo > 0 (2)', async () => {
    sql
      .mockResolvedValueOnce([{ ...CATALOGO_BASE, solo_stock: true }])
      .mockResolvedValueOnce(PRODUCTOS);

    const res = await GET(makeReq('test'), { params: { slug: 'test' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.productos.length).toBe(2);
    expect(body.data.productos.every((p: any) => p.saldo > 0)).toBe(true);
  });

  test('3 — solo_nuevo=true retorna solo productos con es_nuevo=true (1)', async () => {
    sql
      .mockResolvedValueOnce([{ ...CATALOGO_BASE, solo_nuevo: true }])
      .mockResolvedValueOnce(PRODUCTOS);

    const res = await GET(makeReq('test'), { params: { slug: 'test' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.productos.length).toBe(1);
  });
});
