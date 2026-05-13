/** @jest-environment node */
import { describe, expect, it, beforeEach } from '@jest/globals';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({ getServerSession }));
jest.mock('@/lib/db', () => ({ sql }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const admin = { user: { id: '1', name: 'Pablo', rol: 'admin' } };

describe('GET /api/garantias/total', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('401 sin sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const { GET } = await import('@/app/api/garantias/total/route');
    const res = await GET(new Request('http://localhost/api/garantias/total'));
    expect(res.status).toBe(401);
  });

  it('retorna suma total de montos', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValueOnce([{ total: 1500000 }]);
    const { GET } = await import('@/app/api/garantias/total/route');
    const res = await GET(new Request('http://localhost/api/garantias/total'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1500000);
  });

  it('retorna 0 cuando no hay registros', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValueOnce([{ total: 0 }]);
    const { GET } = await import('@/app/api/garantias/total/route');
    const res = await GET(new Request('http://localhost/api/garantias/total'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
  });
});
