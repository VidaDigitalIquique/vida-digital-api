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

describe('GET /api/sueldos?ultimo_para_usuario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    const res = await GET(new Request('http://localhost/api/sueldos?ultimo_para_usuario=3') as any);
    expect(res.status).toBe(401);
  });

  it('retorna 403 si no es admin', async () => {
    mockSession.mockResolvedValue({ user: { id: '2', rol: 'vendedor' } } as any);
    const res = await GET(new Request('http://localhost/api/sueldos?ultimo_para_usuario=3') as any);
    expect(res.status).toBe(403);
  });

  it('retorna ultimo_monto_base null si no hay registros previos', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([] as any);
    mockSql.mockResolvedValueOnce([{ nombre: 'Juan Perez' }] as any);
    const res = await GET(new Request('http://localhost/api/sueldos?ultimo_para_usuario=99') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      ultimo_monto_base: null,
      usuario_id: 99,
      nombre: 'Juan Perez',
    });
  });

  it('retorna ultimo_monto_base con el valor mas reciente', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([{ monto_base: 700000 }] as any);
    mockSql.mockResolvedValueOnce([{ nombre: 'Joseph Levano' }] as any);
    const res = await GET(new Request('http://localhost/api/sueldos?ultimo_para_usuario=13') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      ultimo_monto_base: 700000,
      usuario_id: 13,
      nombre: 'Joseph Levano',
    });
  });
});
