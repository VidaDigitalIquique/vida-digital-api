import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const adminSession = { user: { id: '1', nombre: 'Admin', rol: 'admin' } };
const userSession  = { user: { id: '2', nombre: 'Juan',  rol: 'vendedor' } };
const otherSession = { user: { id: '99', nombre: 'Otro', rol: 'vendedor' } };

const pendiente = { id: 3, user_id: 2, tipo: 'prestamo', monto: '50000', user_nombre: 'Juan', estado: 'pendiente' };
const aceptada  = { ...pendiente, estado: 'aceptada' };
const params    = { id: '3' };

describe('PATCH /api/deudas/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'aceptar' }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(401);
  });

  it('admin acepta solicitud pendiente', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql
      .mockResolvedValueOnce([pendiente] as any)
      .mockResolvedValueOnce([{ ...pendiente, estado: 'aceptada' }] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'aceptar' }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(200);
  });

  it('no-admin no puede aceptar', async () => {
    mockSession.mockResolvedValue(userSession as any);
    mockSql.mockResolvedValueOnce([pendiente] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'aceptar' }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(403);
  });

  it('owner confirma y genera egreso en pettycash', async () => {
    mockSession.mockResolvedValue(userSession as any);
    mockSql
      .mockResolvedValueOnce([aceptada] as any)
      .mockResolvedValueOnce([{ ...aceptada, estado: 'confirmada' }] as any)
      .mockResolvedValueOnce([] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'confirmar' }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it('no-owner no puede confirmar', async () => {
    mockSession.mockResolvedValue(otherSession as any);
    mockSql.mockResolvedValueOnce([aceptada] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'confirmar' }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(403);
  });

  it('admin registra pago en préstamo confirmado', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    const confirmada = { ...pendiente, estado: 'confirmada' };
    mockSql
      .mockResolvedValueOnce([confirmada] as any)
      .mockResolvedValueOnce([{ id: 1, deuda_id: 3, monto: 30000 }] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'pagar', monto: 30000 }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(200);
  });

  it('no-admin no puede registrar pago', async () => {
    mockSession.mockResolvedValue(userSession as any);
    mockSql.mockResolvedValueOnce([{ ...pendiente, estado: 'confirmada' }] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'pagar', monto: 30000 }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(403);
  });
});
