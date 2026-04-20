/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

describe('PUT /api/productos/[id] — categoria', () => {
  let PUT: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/productos/[id]/route');
    PUT = mod.PUT;
  });

  beforeEach(() => {
    getServerSession.mockReset();
    sql.mockReset();
  });

  const makeReq = (body: unknown) =>
    new NextRequest('http://localhost/api/productos/1', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

  const ctx = { params: { id: '1' } };

  test('1 — categoría válida en DB retorna 200', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [2] },
    });

    sql
      .mockResolvedValueOnce([{ nombre: 'Medicina' }])
      .mockResolvedValueOnce([{ empresa_id: 2 }])
      .mockResolvedValueOnce([{ id: 1, categoria: 'Medicina' }]);

    const res = await PUT(makeReq({ categoria: 'Medicina' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.categoria).toBe('Medicina');
  });

  test('2 — categoría no encontrada en DB retorna 400', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [2] },
    });

    sql
      .mockResolvedValueOnce([]);

    const res = await PUT(makeReq({ categoria: 'CategoriaQueNoExiste' }), ctx);
    expect(res.status).toBe(400);
  });

  test('3 — categoria null es aceptada (quitar categoría)', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [2] },
    });

    sql
      .mockResolvedValueOnce([{ empresa_id: 2 }])
      .mockResolvedValueOnce([{ id: 1, categoria: null }]); // salta SELECT categorias porque categoria === null

    const res = await PUT(makeReq({ categoria: null }), ctx);
    expect(res.status).toBe(200);
  });
});
