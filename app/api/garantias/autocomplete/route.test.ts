/** @jest-environment node */
import { describe, expect, it, beforeEach } from '@jest/globals';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({ getServerSession }));
jest.mock('@/lib/db', () => ({ sql }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const admin = { user: { id: '1', name: 'Pablo', rol: 'admin' } };

describe('GET /api/garantias/autocomplete', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('401 sin sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const { GET } = await import('@/app/api/garantias/autocomplete/route');
    const res = await GET(new Request('http://localhost/api/garantias/autocomplete?knumfoli=F001'));
    expect(res.status).toBe(401);
  });

  it('encuentra cliente en vida', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValueOnce([{ cliente: 'Juan Pérez' }]);
    const { GET } = await import('@/app/api/garantias/autocomplete/route');
    const res = await GET(new Request('http://localhost/api/garantias/autocomplete?knumfoli=F001'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cliente).toBe('Juan Pérez');
  });

  it('fallback a sanjh si no encuentra en vida', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValueOnce([]);
    sql.mockResolvedValueOnce([{ cliente: 'María López' }]);
    const { GET } = await import('@/app/api/garantias/autocomplete/route');
    const res = await GET(new Request('http://localhost/api/garantias/autocomplete?knumfoli=S001'));
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.cliente).toBe('María López');
  });

  it('retorna cliente null si no encuentra en ninguna', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValueOnce([]);
    sql.mockResolvedValueOnce([]);
    const { GET } = await import('@/app/api/garantias/autocomplete/route');
    const res = await GET(new Request('http://localhost/api/garantias/autocomplete?knumfoli=ZZZ'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cliente).toBeNull();
  });
});
