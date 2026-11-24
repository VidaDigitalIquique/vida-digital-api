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

const pendiente = { id: 3, user_id: 2, tipo: 'prestamo', monto: '50000', user_nombre: 'Juan', estado: 'pendiente' };
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

  // El flujo aceptar/rechazar/confirmar se elimino en 77574e4 (API simplificada).
  // Estos tests cubren las acciones vigentes: editar y editar_pago.
  it('admin edita deuda existente', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([{ ...pendiente, monto: '60000' }] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'editar', monto: 60000 }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('no-admin no puede editar', async () => {
    mockSession.mockResolvedValue(userSession as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'editar', monto: 60000 }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(403);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('admin edita un pago existente', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([{ id: 1, deuda_id: 3, monto: 30000 }] as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'editar_pago', pago_id: 1, monto: 30000 }),
    });
    const res = await PATCH(req as any, { params });
    expect(res.status).toBe(200);
  });

  it('no-admin no puede editar un pago', async () => {
    mockSession.mockResolvedValue(userSession as any);
    const req = new Request('http://localhost/api/deudas/3', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'editar_pago', pago_id: 1, monto: 30000 }),
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
