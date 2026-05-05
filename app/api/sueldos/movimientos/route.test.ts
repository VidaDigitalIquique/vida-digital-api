import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const adminSession = { user: { id: '1', nombre: 'Admin', rol: 'admin' } };

const movs = [
  { id: 10, tipo: 'adelanto', monto: '30000', mes: 5, anio: 2026 },
  { id: 11, tipo: 'quincena', monto: '15000', mes: 5, anio: 2026 },
];

describe('GET /api/sueldos/movimientos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    const res = await GET(new Request('http://localhost/api/sueldos/movimientos?usuario_id=3&mes=5&anio=2026') as any);
    expect(res.status).toBe(401);
  });

  it('retorna 403 si no es admin', async () => {
    mockSession.mockResolvedValue({ user: { id: '2', rol: 'vendedor' } } as any);
    const res = await GET(new Request('http://localhost/api/sueldos/movimientos?usuario_id=3&mes=5&anio=2026') as any);
    expect(res.status).toBe(403);
  });

  it('retorna movimientos y total_descuentos', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce(movs as any);
    const res = await GET(new Request('http://localhost/api/sueldos/movimientos?usuario_id=3&mes=5&anio=2026') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.movimientos).toHaveLength(2);
    expect(body.total_descuentos).toBe(45000);
  });

  it('usa mes y anio actual si no se pasan', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([] as any);
    const res = await GET(new Request('http://localhost/api/sueldos/movimientos?usuario_id=3') as any);
    expect(res.status).toBe(200);
  });
});
