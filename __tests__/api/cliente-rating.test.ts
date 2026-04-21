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

describe('GET /api/clientes/[kcodclie]/rating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin sesión → 401', async () => {
    const { GET } = require('@/app/api/clientes/[kcodclie]/rating/route');

    getServerSession.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/clientes/CLI001/rating');
    const res = await GET(req, { params: { kcodclie: 'CLI001' } });

    expect(res.status).toBe(401);
  });

  test('cliente con rating existente → { estrellas: 3 }', async () => {
    const { GET } = require('@/app/api/clientes/[kcodclie]/rating/route');

    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'vendedor', empresas: [1, 2] } });
    sql.mockResolvedValueOnce([{ estrellas: 3 }]);

    const req = new NextRequest('http://localhost/api/clientes/CLI001/rating');
    const res = await GET(req, { params: { kcodclie: 'CLI001' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.estrellas).toBe(3);
  });

  test('cliente sin rating en tabla → { estrellas: 0 }', async () => {
    const { GET } = require('@/app/api/clientes/[kcodclie]/rating/route');

    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'vendedor', empresas: [1, 2] } });
    sql.mockResolvedValueOnce([]);

    const req = new NextRequest('http://localhost/api/clientes/CLI999/rating');
    const res = await GET(req, { params: { kcodclie: 'CLI999' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.estrellas).toBe(0);
  });
});
