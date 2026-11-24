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

describe('GET /api/deseados — enriquece producto_imagen_url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'admin', empresas: [1, 2] } });
  });

  test('adjunta la imagen real del catalogo por codigo; null si no hay', async () => {
    const { GET } = require('@/app/api/deseados/route');
    sql
      .mockResolvedValueOnce([
        { id: 1, codigo: 'A1' },
        { id: 2, codigo: 'B2' },
        { id: 3, codigo: null },
      ])
      .mockResolvedValueOnce([{ codigo: 'A1', imagen_url: 'https://x/A1.jpg' }]);

    const res = await GET(new NextRequest('http://localhost/api/deseados'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].producto_imagen_url).toBe('https://x/A1.jpg');
    expect(body.data[1].producto_imagen_url).toBeNull();
    expect(body.data[2].producto_imagen_url).toBeNull();
  });

  test('deduplica codigos antes de consultar', async () => {
    const { GET } = require('@/app/api/deseados/route');
    sql
      .mockResolvedValueOnce([{ id: 1, codigo: 'A1' }, { id: 2, codigo: 'A1' }])
      .mockResolvedValueOnce([]);

    await GET(new NextRequest('http://localhost/api/deseados'));
    const params = sql.mock.calls[1][1];
    expect(params).toEqual(['A1']);
  });

  test('filas sin codigo: una sola consulta (no rompe clientes-nuevos-filtro)', async () => {
    const { GET } = require('@/app/api/deseados/route');
    sql.mockResolvedValueOnce([{ id: 10, descripcion: 'Producto A' }]);

    const res = await GET(new NextRequest('http://localhost/api/deseados?estado=pendiente'));
    const body = await res.json();

    expect(sql).toHaveBeenCalledTimes(1);
    expect(body.data[0].producto_imagen_url).toBeNull();
  });

  test('si la 2a consulta devuelve undefined no explota', async () => {
    const { GET } = require('@/app/api/deseados/route');
    sql.mockResolvedValueOnce([{ id: 1, codigo: 'A1' }]).mockResolvedValueOnce(undefined);

    const res = await GET(new NextRequest('http://localhost/api/deseados'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].producto_imagen_url).toBeNull();
  });
});
