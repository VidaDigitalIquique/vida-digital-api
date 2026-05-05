import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const adminSession = { user: { id: '1', nombre: 'Admin', rol: 'admin' } };
const userSession  = { user: { id: '2', nombre: 'Juan',  rol: 'vendedor' } };

describe('GET /api/deudas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    const res = await GET(new Request('http://localhost/api/deudas') as any);
    expect(res.status).toBe(401);
  });

  it('admin ve todas y triggerea caducidad', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, user_id: 2, estado: 'pendiente' }] as any);
    const res = await GET(new Request('http://localhost/api/deudas') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deudas).toHaveLength(1);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('user ve solo sus propias deudas', async () => {
    mockSession.mockResolvedValue(userSession as any);
    mockSql.mockResolvedValueOnce([{ id: 2, user_id: 2, estado: 'pendiente' }] as any);
    const res = await GET(new Request('http://localhost/api/deudas') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deudas[0].user_id).toBe(2);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/deudas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin crea deuda para un trabajador', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql
      .mockResolvedValueOnce([{ nombre: 'Juan' }] as any)
      .mockResolvedValueOnce([{ id: 5, tipo: 'adelanto', monto: 50000 }] as any);
    const req = new Request('http://localhost/api/deudas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: 3, tipo: 'adelanto', monto: 50000 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('retorna 403 si no es admin', async () => {
    mockSession.mockResolvedValue(userSession as any);
    const req = new Request('http://localhost/api/deudas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: 3, tipo: 'adelanto', monto: 50000 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('retorna 400 con tipo inválido', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    const req = new Request('http://localhost/api/deudas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: 3, tipo: 'desconocido', monto: 100000 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    const req = new Request('http://localhost/api/deudas', {
      method: 'POST',
      body: JSON.stringify({ usuario_id: 3, tipo: 'prestamo', monto: 50000 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
