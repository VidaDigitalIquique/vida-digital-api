import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockGetServerSession = vi.mocked(getServerSession);

const mockSession = { user: { rol: 'vendedor', empresas: [2] } };

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/ventas/clientes');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

function getSqlTextFromFirstCall() {
  const firstArg = mockSql.mock.calls[0]?.[0] as TemplateStringsArray | string | undefined;
  if (!firstArg) return '';
  return Array.isArray(firstArg) ? firstArg.join('') : String(firstArg);
}

describe('GET /api/ventas/clientes - filtros kardex (tests rojos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession as any);
  });

  it('Test 1 — filtro por estrellas viaja al SQL', async () => {
    mockSql.mockResolvedValueOnce([] as any);

    const res = await GET(makeRequest({ q: 'juan', empresaSlug: 'vida', estrellas: '3' }));
    const sqlText = getSqlTextFromFirstCall();

    expect(mockSql).toHaveBeenCalled();
    expect(sqlText).toContain('cliente_ratings');
    expect(res.status).toBe(200);
  });

  it('Test 2 — filtro por ciudad viaja al SQL', async () => {
    mockSql
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);

    const res = await GET(makeRequest({ q: 'juan', empresaSlug: 'vida', ciudad: 'Iquique' }));
    const sqlText = mockSql.mock.calls[1][0].toString();

    expect(mockSql).toHaveBeenCalled();
    expect(mockSql.mock.calls[0][0].toString()).toContain('ciudad_alias');
    expect(sqlText).toContain('cliente_ratings');
    expect(res.status).toBe(200);
  });

  it('Test 3 — búsqueda activa solo con filtro (sin q)', async () => {
    mockSql.mockResolvedValueOnce([] as any);

    const res = await GET(makeRequest({ empresaSlug: 'vida', estrellas: '5' }));

    expect(res.status).toBe(200);
  });

  it('Test 4 — respuesta incluye campo estrellas', async () => {
    mockSql.mockResolvedValueOnce([
      { kcodclie: '001', nombress: 'Test', estrellas: 4 },
    ] as any);

    const res = await GET(makeRequest({ q: 'juan', empresaSlug: 'vida' }));
    const body = await res.json();
    const sqlText = getSqlTextFromFirstCall();

    expect(sqlText).toContain('cliente_ratings');
    expect(res.status).toBe(200);
    expect(body.data[0].estrellas).toBe(4);
  });
});
