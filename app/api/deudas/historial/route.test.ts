import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const admin    = { user: { name: 'Admin',    rol: 'admin'    } };
const vendedor = { user: { name: 'Vendedor', rol: 'vendedor' } };

function makeReq(params?: Record<string, string>) {
  const url = new URL('http://localhost/api/deudas/historial');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as any;
}

const prestamoItem = { deuda_id: 1, pago_id: null, tipo: 'prestamo', monto: 50000, descripcion: null, fecha_hora: '2026-05-01T10:00:00Z', item_tipo: 'deuda' };

describe('GET /api/deudas/historial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 — devuelve prestamos y adelantos para admin', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql
      .mockResolvedValueOnce([prestamoItem] as any)  // prestamoDeudas
      .mockResolvedValueOnce([] as any)              // adelantoDeudas
      .mockResolvedValueOnce([] as any)              // prestamoPagos (Promise.all)
      .mockResolvedValueOnce([] as any);             // adelantoPagos (Promise.all)

    const res = await GET(makeReq({ usuario_id: '3' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prestamos).toHaveLength(1);
    expect(body.adelantos).toHaveLength(0);
    expect(body.prestamos[0].tipo).toBe('prestamo');
  });

  it('400 — falta usuario_id', async () => {
    mockSession.mockResolvedValue(admin as any);
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it('403 — rechaza no-admin', async () => {
    mockSession.mockResolvedValue(vendedor as any);
    const res = await GET(makeReq({ usuario_id: '3' }));
    expect(res.status).toBe(403);
  });
});
