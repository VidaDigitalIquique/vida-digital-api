import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const adminSession = { user: { id: '1', nombre: 'Admin', rol: 'admin' } };

function req(method: string, body?: object) {
  return new Request('http://localhost/api/trabajadores/13/config', {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  }) as any;
}

describe('GET /api/trabajadores/[id]/config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    const res = await GET(req('GET'), { params: { id: '13' } });
    expect(res.status).toBe(401);
  });

  it('retorna 403 si no es admin', async () => {
    mockSession.mockResolvedValue({ user: { id: '2', rol: 'vendedor' } } as any);
    const res = await GET(req('GET'), { params: { id: '13' } });
    expect(res.status).toBe(403);
  });

  it('retorna monto_base 0 si no hay config', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([] as any);
    const res = await GET(req('GET'), { params: { id: '13' } });
    expect(await res.json()).toEqual({ monto_base: 0 });
  });

  it('retorna monto_base guardado', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([{ monto_base: 650000 }] as any);
    const res = await GET(req('GET'), { params: { id: '13' } });
    expect(await res.json()).toEqual({ monto_base: 650000 });
  });
});

describe('PATCH /api/trabajadores/[id]/config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upsert el monto_base', async () => {
    mockSession.mockResolvedValue(adminSession as any);
    mockSql.mockResolvedValueOnce([] as any);
    const res = await PATCH(req('PATCH', { monto_base: 750000 }), { params: { id: '13' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
