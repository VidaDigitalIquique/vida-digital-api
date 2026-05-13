import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);
const admin = { user: { id: '1', nombre: 'Admin', rol: 'admin' } };
const vendedor = { user: { id: '2', nombre: 'Juan Venta', rol: 'vendedor' } };

const mockRow = {
  empresa: 'vida', knumfoli: 'F001', fechanvt: '2024-01-15', id_tdocu: '203', vendedor: 'Juan',
  kcodclie: '100', nombress: 'Cliente A', celular: '', email01: '', ciudad: '',
  kcodcli2: null, factura_nombre: null, items: null,
  seg_id: null, prioridad: null, estado: null, asignado_a: null, notas_internas: null,
  ultima_interaccion: null, proximo_contacto: null,
  ultima_observacion: null,
};

describe('GET /api/seguimientos', () => {
  beforeEach(() => vi.clearAllMocks());
  it('401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    expect((await GET(new Request('http://localhost/api/seguimientos'))).status).toBe(401);
  });
  it('admin recibe notas de vida con seguimiento null', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql.mockResolvedValue([mockRow] as any);
    const res = await GET(new Request('http://localhost/api/seguimientos?empresa=vida'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].cliente_comprador.nombress).toBe('Cliente A');
    expect(body.data[0].seguimiento).toBeNull();
  });
  it('vendedor ignora param vendedor externo y usa su nombre de sesión', async () => {
    mockSession.mockResolvedValue(vendedor as any);
    mockSql.mockResolvedValue([] as any);
    const res = await GET(new Request('http://localhost/api/seguimientos?empresa=vida&vendedor=Admin'));
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('incluye ultima_observacion en seguimiento cuando la ultima interaccion tiene resultado', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql.mockResolvedValue([{
      ...mockRow,
      seg_id: 1, estado: 'activo',
      ultima_interaccion: '2024-01-20',
      proximo_contacto: '2024-01-25',
      ultima_observacion: 'Cliente pide descuento por volumen',
    }] as any);
    const res = await GET(new Request('http://localhost/api/seguimientos?empresa=vida'));
    const body = await res.json();
    expect(body.data[0].seguimiento.ultima_observacion).toBe('Cliente pide descuento por volumen');
  });

  it('retorna ultima_observacion null cuando no hay interacciones', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql.mockResolvedValue([{
      ...mockRow,
      seg_id: 1, estado: 'activo',
      ultima_interaccion: null,
      proximo_contacto: null,
      ultima_observacion: null,
    }] as any);
    const res = await GET(new Request('http://localhost/api/seguimientos?empresa=vida'));
    const body = await res.json();
    expect(body.data[0].seguimiento.ultima_observacion).toBeNull();
  });
});

describe('POST /api/seguimientos', () => {
  beforeEach(() => vi.clearAllMocks());
  it('401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    expect((await POST(new Request('http://x', { method: 'POST', body: '{}' }))).status).toBe(401);
  });
  it('upsert seguimiento retorna id', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql.mockResolvedValue([{ id: 5, empresa: 'vida', knumfoli: 'F001' }] as any);
    const res = await POST(new Request('http://x', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa: 'vida', knumfoli: 'F001' }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(5);
  });
  it('400 sin empresa', async () => {
    mockSession.mockResolvedValue(admin as any);
    const res = await POST(new Request('http://x', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knumfoli: 'F001' }),
    }));
    expect(res.status).toBe(400);
  });
});
