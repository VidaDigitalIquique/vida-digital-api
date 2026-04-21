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

jest.mock('@/lib/services/product-service', () => ({
  recalculateNuevoFlags: jest.fn().mockResolvedValue(0),
}));

describe('sync-from-winfac: sincronización de ubicaciones_bodega', () => {
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/admin/sync-from-winfac/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    getServerSession.mockReset();
    sql.mockReset();
    getServerSession.mockResolvedValue({ user: { rol: 'admin', empresas: [1, 2] } });
    sql
      .mockResolvedValueOnce([{ count: 5 }])   // sanjh upsert
      .mockResolvedValueOnce([{ count: 10 }])  // vida upsert
      .mockResolvedValue([]);                  // resto
  });

  test('el sync actualiza ubicaciones_bodega para sanjh (empresa_id = 1)', async () => {
    const req = new Request('http://localhost/api/admin/sync-from-winfac', { method: 'POST' });
    await POST(req);

    const hasUbicacionesSanjh = sql.mock.calls.some(([strings]) => {
      const template = Array.from(strings as string[]).join('');
      return template.includes('ubicaciones_bodega') && template.includes('empresa_id = 1');
    });

    expect(hasUbicacionesSanjh).toBe(true);
  });

  test('el sync actualiza ubicaciones_bodega para vida (empresa_id = 2)', async () => {
    const req = new Request('http://localhost/api/admin/sync-from-winfac', { method: 'POST' });
    await POST(req);

    const hasUbicacionesVida = sql.mock.calls.some(([strings]) => {
      const template = Array.from(strings as string[]).join('');
      return template.includes('ubicaciones_bodega') && template.includes('empresa_id = 2');
    });

    expect(hasUbicacionesVida).toBe(true);
  });

  test('el sync retorna 200 con message que contiene "completada"', async () => {
    const req = new Request('http://localhost/api/admin/sync-from-winfac', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/completada/i);
  });
});
