/** @jest-environment node */
import { describe, expect, it, beforeEach } from '@jest/globals';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({ getServerSession }));
jest.mock('@/lib/db', () => ({ sql }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const admin = { user: { id: '1', name: 'Pablo', rol: 'admin' } };

const mockLogs = [
  { id: 2, garantia_id: 1, usuario: 'Pablo', campo: 'estado',
    valor_anterior: 'recibido', valor_nuevo: 'devuelto', created_at: '2026-05-02T10:00:00.000Z' },
  { id: 1, garantia_id: 1, usuario: 'Pablo', campo: 'creacion',
    valor_anterior: null, valor_nuevo: 'F001', created_at: '2026-05-01T10:00:00.000Z' },
];

describe('GET /api/garantias/[id]/log', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('401 sin sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const { GET } = await import('@/app/api/garantias/[id]/log/route');
    const res = await GET(new Request('http://localhost/api/garantias/1/log'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('retorna historial ordenado por fecha descendente', async () => {
    getServerSession.mockResolvedValue(admin);
    sql.mockResolvedValue(mockLogs);
    const { GET } = await import('@/app/api/garantias/[id]/log/route');
    const res = await GET(new Request('http://localhost/api/garantias/1/log'), { params: { id: '1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].campo).toBe('estado');
  });
});
