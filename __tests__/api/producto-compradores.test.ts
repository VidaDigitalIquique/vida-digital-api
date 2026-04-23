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

describe('GET /api/productos/[id]/compradores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin sesión → 401', async () => {
    getServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/productos/[id]/compradores/route');
    const req = new NextRequest('http://localhost/api/productos/ABC123/compradores');
    const res = await GET(req, { params: { id: 'ABC123' } });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: expect.any(String) });
  });

  test('con rol bodeguero → 403', async () => {
    getServerSession.mockResolvedValue({ user: { rol: 'bodeguero' } });

    const { GET } = await import('@/app/api/productos/[id]/compradores/route');
    const req = new NextRequest('http://localhost/api/productos/ABC123/compradores');
    const res = await GET(req, { params: { id: 'ABC123' } });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: expect.any(String) });
  });

  test('con sesión válida → retorna array de compradores agrupado con sus compras', async () => {
    getServerSession.mockResolvedValue({ user: { rol: 'admin' } });
    sql.mockResolvedValue([
      {
        kcodclie: 100,
        nombre: 'JUAN PEREZ',
        celular: '+56912345678',
        pais: 'Chile',
        ciudad: 'Arica',
        estrellas: 3,
        fecha: '2024-01-15',
        nvta: '001234',
        cantidad: 2,
        precio: 150.0,
        empresa_id: 2,
      },
    ]);

    const { GET } = await import('@/app/api/productos/[id]/compradores/route');
    const req = new NextRequest('http://localhost/api/productos/ABC123/compradores');
    const res = await GET(req, { params: { id: 'ABC123' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      data: [
        {
          kcodclie: 100,
          nombre: 'JUAN PEREZ',
          celular: '+56912345678',
          pais: 'Chile',
          ciudad: 'Arica',
          estrellas: 3,
          compras: [
            {
              fecha: '2024-01-15',
              nvta: '001234',
              cantidad: 2,
              precio: 150.0,
              empresa_id: 2,
            },
          ],
        },
      ],
    });
  });

  test('sin compradores → retorna array vacío', async () => {
    getServerSession.mockResolvedValue({ user: { rol: 'vendedor' } });
    sql.mockResolvedValue([]);

    const { GET } = await import('@/app/api/productos/[id]/compradores/route');
    const req = new NextRequest('http://localhost/api/productos/ABC123/compradores');
    const res = await GET(req, { params: { id: 'ABC123' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });
});
