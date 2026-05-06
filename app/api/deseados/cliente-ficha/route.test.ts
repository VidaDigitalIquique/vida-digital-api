import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const session = { user: { name: 'Admin', rol: 'admin' } };

function makeReq(params?: Record<string, string>) {
  const url = new URL('http://localhost/api/deseados/cliente-ficha');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as any;
}

describe('GET /api/deseados/cliente-ficha', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 — cliente_deseado_id retorna ficha fuente=nuevo', async () => {
    mockSession.mockResolvedValue(session as any);
    mockSql.mockResolvedValueOnce([{
      id: 1, nombre: 'Juan Pérez', whatsapp: '+56912345678',
      ciudad: 'Santiago', pais: 'Chile', notas: 'cliente VIP',
    }]);

    const res = await GET(makeReq({ cliente_deseado_id: '1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fuente).toBe('nuevo');
    expect(body.nombre).toBe('Juan Pérez');
    expect(body.whatsapp).toBe('+56912345678');
    expect(body.notas).toBe('cliente VIP');
  });

  it('200 — kcodclie retorna ficha fuente=winfac', async () => {
    mockSession.mockResolvedValue(session as any);
    mockSql.mockResolvedValueOnce([{
      kcodclie: 'C001', nombress: 'Empresa SA', celular: '+56999888777',
      ciudad: 'Valparaíso', pais: 'Chile',
    }]);

    const res = await GET(makeReq({ kcodclie: 'C001' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fuente).toBe('winfac');
    expect(body.nombre).toBe('Empresa SA');
    expect(body.telefono).toBe('+56999888777');
  });

  it('404 — cliente no encontrado', async () => {
    mockSession.mockResolvedValue(session as any);
    mockSql.mockResolvedValueOnce([]);

    const res = await GET(makeReq({ cliente_deseado_id: '999' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('no_encontrado');
  });

  it('400 — sin parámetros', async () => {
    mockSession.mockResolvedValue(session as any);
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it('403 — no autenticado', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(makeReq({ cliente_deseado_id: '1' }));
    expect(res.status).toBe(403);
  });
});
