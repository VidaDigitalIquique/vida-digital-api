/**
 * @jest-environment node
 */

const sql = jest.fn();

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

const CATALOGO_BASE = {
  id: 1, slug: 'test', titulo: 'Test', descripcion: null,
  activo: true, mostrar_precio: false, margen_precio: 0,
  solo_stock: false, solo_nuevo: true,
  palabras_incluir: '', palabras_excluir: '',
  ambas_empresas: true, empresa_id: 2, categoria: null,
  empresa_slug: 'vida-digital',
};

const PRODUCTOS = [
  { codigo: 'SKU-CONT-A', detalle: 'Del contenedor mas reciente', imagen_url: null, cantcaja: 1, umed: null, costo: 100, saldo: 5, es_nuevo: true },
  { codigo: 'SKU-CONT-B', detalle: 'Tambien del contenedor reciente', imagen_url: null, cantcaja: 1, umed: null, costo: 100, saldo: 3, es_nuevo: true },
  { codigo: 'SKU-VIEJO', detalle: 'Del ingreso anterior con fecha_ingreso mayor (sync reciente)', imagen_url: null, cantcaja: 1, umed: null, costo: 100, saldo: 2, es_nuevo: true },
];

describe('GET /api/catalogos/public/[slug] — solo_nuevo con prefijo 101', () => {
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

  test('usa prefijo 101, año mas alto y folio mas alto — no fecha_ingreso', async () => {
    // 1. Catalogo query
    sql.mockResolvedValueOnce([CATALOGO_BASE]);
    // 2. Productos query
    sql.mockResolvedValueOnce(PRODUCTOS);
    // 3. Ultimo ingreso real (prefijo 101, max anio, max folio)
    sql.mockResolvedValueOnce([{ anio: '26', folio: '027541' }]);
    // 4. Codigos de ese contenedor
    sql.mockResolvedValueOnce([{ codigo: 'SKU-CONT-A' }, { codigo: 'SKU-CONT-B' }]);

    const res = await GET(makeReq('test'), { params: { slug: 'test' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Solo los 2 del contenedor mas reciente, no SKU-VIEJO
    expect(body.data.productos).toHaveLength(2);
    expect(body.data.productos.map((p: any) => p.codigo).sort())
      .toEqual(['SKU-CONT-A', 'SKU-CONT-B']);
  });

  test('ignora prefijo 103 aunque tenga folio mayor', async () => {
    sql.mockResolvedValueOnce([CATALOGO_BASE]);
    sql.mockResolvedValueOnce(PRODUCTOS);
    // Solo hay ingresos 103, sin 101
    sql.mockResolvedValueOnce([]);

    const res = await GET(makeReq('test'), { params: { slug: 'test' } });
    const body = await res.json();

    // Sin ingreso 101, latestCodigos vacío → 0 productos
    expect(body.data.productos).toHaveLength(0);
  });

  test('sin ingresos reales retorna vacío', async () => {
    sql.mockResolvedValueOnce([CATALOGO_BASE]);
    sql.mockResolvedValueOnce(PRODUCTOS);
    // Sin ningún ingreso 101
    sql.mockResolvedValueOnce([]);

    const res = await GET(makeReq('test'), { params: { slug: 'test' } });
    const body = await res.json();

    expect(body.data.productos).toHaveLength(0);
  });
});
