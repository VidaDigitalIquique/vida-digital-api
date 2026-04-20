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

describe('PUT /api/productos/[id] — categoria actualiza todos los lotes', () => {
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

  test('1 — categoria válida actualiza todos los lotes retorna 200', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [2] },
    });

    sql
      .mockResolvedValueOnce([{ nombre: 'Medicina' }])
      .mockResolvedValueOnce([{ empresa_id: 2, codigo: 'MED-01' }])
      .mockResolvedValueOnce([{ id: 1, categoria: 'Medicina' }, { id: 2, categoria: 'Medicina' }]);

    const res = await PUT(makeReq({ categoria: 'Medicina' }), ctx);
    expect(res.status).toBe(200);
  });

  test('2 — el UPDATE usa WHERE codigo + empresa_id, no WHERE id', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [2] },
    });

    sql
      .mockResolvedValueOnce([{ nombre: 'Medicina' }])
      .mockResolvedValueOnce([{ empresa_id: 2, codigo: 'MED-01' }])
      .mockResolvedValueOnce([{ id: 1, categoria: 'Medicina' }, { id: 2, categoria: 'Medicina' }]);

    await PUT(makeReq({ categoria: 'Medicina' }), ctx);

    expect(sql.mock.calls.length).toBe(3);

    const templateStrings: string[] = sql.mock.calls[2][0];
    const fullTemplate = templateStrings.join('');
    expect(fullTemplate).not.toMatch(/WHERE\s+id\s*=/i);
    expect(fullTemplate.toLowerCase()).toContain('codigo');
  });

  test('3 — categoria null actualiza todos los lotes retorna 200', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [2] },
    });

    sql
      .mockResolvedValueOnce([{ empresa_id: 2, codigo: 'MED-01' }])
      .mockResolvedValueOnce([{ id: 1, categoria: null }, { id: 2, categoria: null }]);

    const res = await PUT(makeReq({ categoria: null }), ctx);
    expect(res.status).toBe(200);
  });
});
