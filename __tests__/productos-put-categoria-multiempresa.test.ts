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

describe('PUT /api/productos/[id] — categoria UPDATE sin filtro empresa_id', () => {
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

  const setupMocks = () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [2] },
    });
    sql
      .mockResolvedValueOnce([{ nombre: 'Ortopédia' }])
      .mockResolvedValueOnce([{ empresa_id: 2, codigo: 'YX-700' }])
      .mockResolvedValueOnce([{ id: 1, categoria: 'Ortopédia' }, { id: 2, categoria: 'Ortopédia' }]);
  };

  test('1 — el UPDATE de categoria no filtra por empresa_id', async () => {
    setupMocks();

    const res = await PUT(makeReq({ categoria: 'Ortopédia' }), ctx);

    expect(sql.mock.calls.length).toBe(3);

    const templateStrings: string[] = sql.mock.calls[2][0];
    const fullTemplate = templateStrings.join('');
    expect(fullTemplate).not.toContain('empresa_id');
    expect(res.status).toBe(200);
  });

  test('2 — sin filtros devuelve 200 y el UPDATE se ejecuta', async () => {
    setupMocks();

    const res = await PUT(makeReq({ categoria: 'Ortopédia' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });
});
