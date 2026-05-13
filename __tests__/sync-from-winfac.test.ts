/**
 * @jest-environment node
 */
const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

jest.mock('@/lib/services/product-service', () => ({
  recalculateNuevoFlags: jest.fn(async () => 0),
}));

describe('POST /api/admin/sync-from-winfac', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    sql.mockReset();
  });

  test('Rechaza sin sesión (401)', async () => {
    const { POST } = await import('@/app/api/admin/sync-from-winfac/route');

    getServerSession.mockResolvedValue(null);

    const req = new Request('http://localhost/api/admin/sync-from-winfac', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('Rechaza rol bodega (401)', async () => {
    const { POST } = await import('@/app/api/admin/sync-from-winfac/route');

    getServerSession.mockResolvedValue({
      user: { rol: 'bodega' },
    });

    const req = new Request('http://localhost/api/admin/sync-from-winfac', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('Acepta rol vendedor (200)', async () => {
    const { POST } = await import('@/app/api/admin/sync-from-winfac/route');

    getServerSession.mockResolvedValue({
      user: { rol: 'vendedor' },
    });

    sql.mockResolvedValueOnce([{ count: 5 }]);
    sql.mockResolvedValueOnce([{ count: 3 }]);

    const req = new Request('http://localhost/api/admin/sync-from-winfac', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test('Respuesta exitosa tiene estructura correcta', async () => {
    const { POST } = await import('@/app/api/admin/sync-from-winfac/route');

    getServerSession.mockResolvedValue({
      user: { rol: 'admin' },
    });

    sql.mockResolvedValueOnce([{ count: 10 }]);
    sql.mockResolvedValueOnce([{ count: 10 }]);

    const req = new Request('http://localhost/api/admin/sync-from-winfac', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        sanjh_count: expect.any(Number),
        vida_count: expect.any(Number),
      })
    );
  });

  test('sanjh_count y vida_count reflejan filas actualizadas', async () => {
    const { POST } = await import('@/app/api/admin/sync-from-winfac/route');

    getServerSession.mockResolvedValue({
      user: { rol: 'admin' },
    });

    sql.mockResolvedValueOnce([{ count: 15 }]);
    sql.mockResolvedValueOnce([{ count: 8 }]);

    const req = new Request('http://localhost/api/admin/sync-from-winfac', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sanjh_count).toBe(15);
    expect(body.vida_count).toBe(8);
  });
});
