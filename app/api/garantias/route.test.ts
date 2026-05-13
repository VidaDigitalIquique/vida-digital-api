/** @jest-environment node */
import { describe, expect, it, beforeEach } from '@jest/globals';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({ getServerSession }));
jest.mock('@/lib/db', () => ({ sql }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const admin = { user: { id: '1', name: 'Pablo', rol: 'admin' } };
const vendedor = { user: { id: '2', name: 'Juan', rol: 'vendedor' } };

const mockGarantia = {
  id: 1, knumfoli: 'F001', cliente: 'Cliente A', monto: 0, observaciones: null,
  estado: 'recibido', created_at: '2026-05-01T10:00:00.000Z', updated_at: '2026-05-01T10:00:00.000Z',
};

describe('GET /api/garantias', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('401 sin sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const { GET } = await import('@/app/api/garantias/route');
    const res = await GET(new Request('http://localhost/api/garantias'));
    expect(res.status).toBe(401);
  });

  it('retorna lista de garantias para admin', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValue([mockGarantia]);
    const { GET } = await import('@/app/api/garantias/route');
    const res = await GET(new Request('http://localhost/api/garantias'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].knumfoli).toBe('F001');
  });
});

describe('POST /api/garantias', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('401 sin sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const { POST } = await import('@/app/api/garantias/route');
    const res = await POST(new Request('http://localhost/api/garantias', {
      method: 'POST', body: JSON.stringify({ knumfoli: 'F001', cliente: 'C' }),
    }));
    expect(res.status).toBe(401);
  });

  it('crea garantia y log de creacion', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValueOnce([mockGarantia]);
    sql.mockResolvedValueOnce([{ id: 1 }]);
    const { POST } = await import('@/app/api/garantias/route');
    const res = await POST(new Request('http://localhost/api/garantias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knumfoli: 'F001', cliente: 'Cliente A' }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.knumfoli).toBe('F001');
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('400 si falta knumfoli o cliente', async () => {
    getServerSession.mockResolvedValue(admin);
    const { POST } = await import('@/app/api/garantias/route');
    const res = await POST(new Request('http://localhost/api/garantias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knumfoli: '' }),
    }));
    expect(res.status).toBe(400);
  });
});
