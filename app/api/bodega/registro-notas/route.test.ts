import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

describe('app/api/bodega/registro-notas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET devuelve lista de registros', async () => {
    mockSession.mockResolvedValue({ user: { id: '3', nombre: 'Pedro', rol: 'bodeguero' } } as any);
    mockSql.mockResolvedValueOnce([
      {
        id: 1,
        folio: '001234',
        empresa_id: 2,
        usuario_nombre: 'Pedro',
        observacion: 'Urgente',
        created_at: '2026-04-24T10:00:00Z',
      },
    ] as any);

    const res = await GET(new Request('http://localhost/api/bodega/registro-notas') as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].folio).toBe('001234');

    const firstArg = mockSql.mock.calls[0]?.[0];
    const queryText = Array.isArray(firstArg) ? firstArg.join(' ') : String(firstArg);
    expect(queryText).toContain('registro_notas_bodega');
  });

  it('GET retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);

    const res = await GET(new Request('http://localhost/api/bodega/registro-notas') as any);

    expect(res.status).toBe(401);
  });

  it('POST crea registro correctamente', async () => {
    mockSession.mockResolvedValue({ user: { id: '3', nombre: 'Pedro', rol: 'bodeguero' } } as any);
    mockSql.mockResolvedValueOnce([
      {
        id: 1,
        folio: '001234',
        empresa_id: 2,
        usuario_id: 3,
        usuario_nombre: 'Pedro',
        observacion: null,
        created_at: '2026-04-24T10:00:00Z',
      },
    ] as any);

    const req = new Request('http://localhost/api/bodega/registro-notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio: '001234', empresa_id: 2, observacion: null }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(201);

    const firstArg = mockSql.mock.calls[0]?.[0];
    const queryText = Array.isArray(firstArg) ? firstArg.join(' ') : String(firstArg);
    expect(queryText).toContain('INSERT');
  });

  it('POST retorna 400 si falta folio', async () => {
    mockSession.mockResolvedValue({ user: { id: '3', nombre: 'Pedro', rol: 'bodeguero' } } as any);

    const req = new Request('http://localhost/api/bodega/registro-notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id: 2 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});
