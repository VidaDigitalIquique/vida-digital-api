/** @jest-environment node */
import { describe, expect, it, beforeEach } from '@jest/globals';

const getServerSession = jest.fn();
const sql = Object.assign(jest.fn(), { unsafe: jest.fn((s: string) => s) });

jest.mock('next-auth', () => ({ getServerSession }));
jest.mock('@/lib/db', () => ({ sql }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const admin = { user: { id: '1', name: 'Pablo', rol: 'admin' } };

const mockGarantia = {
  id: 1, knumfoli: 'F001', cliente: 'Cliente A', monto: 0, observaciones: null,
  estado: 'recibido', created_at: '2026-05-01T10:00:00.000Z', updated_at: '2026-05-01T10:00:00.000Z',
};

describe('PATCH /api/garantias/[id]', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('401 sin sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const { PATCH } = await import('@/app/api/garantias/[id]/route');
    const res = await PATCH(new Request('http://localhost/api/garantias/1', {
      method: 'PATCH', body: JSON.stringify({ campo: 'estado', valor: 'devuelto' }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('cambia estado e inserta log', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValueOnce([mockGarantia]);
    sql.mockResolvedValueOnce([{ ...mockGarantia, estado: 'devuelto' }]);
    sql.mockResolvedValueOnce([{ id: 1 }]);
    const { PATCH } = await import('@/app/api/garantias/[id]/route');
    const res = await PATCH(new Request('http://localhost/api/garantias/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo: 'estado', valor: 'devuelto' }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('400 si campo no es valido', async () => {
    getServerSession.mockResolvedValue(admin);
    const { PATCH } = await import('@/app/api/garantias/[id]/route');
    const res = await PATCH(new Request('http://localhost/api/garantias/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo: 'direccion', valor: 'Iquique' }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(400);
  });
});
