import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const makeReq = (folioNuevo?: string, url = 'http://localhost/api/bodega/despachos/1/folio'): any =>
  new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folio_nuevo: folioNuevo }),
  });

const asQuery = (call: any) =>
  Array.isArray(call) ? call.join(' ') : String(call);

describe('PATCH /api/bodega/despachos/[id]/folio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 401 sin sesión', async () => {
    mockSession.mockResolvedValue(null as any);
    const res = await PATCH(makeReq('999'), {} as any);
    expect(res.status).toBe(401);
  });

  it('retorna 400 si folio_nuevo está vacío', async () => {
    mockSession.mockResolvedValue({ user: { nombre: 'P', empresas: [1] } } as any);
    const res = await PATCH(makeReq('   '), { params: { id: '1' } } as any);
    expect(res.status).toBe(400);
  });

  it('retorna 400 si folio_nuevo no es solo dígitos', async () => {
    mockSession.mockResolvedValue({ user: { nombre: 'P', empresas: [1] } } as any);
    const res = await PATCH(makeReq('123-ABC'), { params: { id: '1' } } as any);
    expect(res.status).toBe(400);
  });

  it('retorna 404 si el despacho no existe', async () => {
    mockSession.mockResolvedValue({ user: { nombre: 'P', empresas: [1] } } as any);
    mockSql.mockResolvedValueOnce([] as any);
    const res = await PATCH(makeReq('999'), { params: { id: '1' } } as any);
    expect(res.status).toBe(404);
  });

  it('retorna 404 si el despacho no pertenece a una empresa del usuario', async () => {
    mockSession.mockResolvedValue({ user: { nombre: 'P', empresas: [1] } } as any);
    mockSql.mockResolvedValueOnce([{ id: 1, folio: '123', empresa_id: 99 }] as any);
    const res = await PATCH(makeReq('999'), { params: { id: '1' } } as any);
    expect(res.status).toBe(404);
    // No debe ejecutar UPDATE
    expect(mockSql.mock.calls.length).toBe(1);
  });

  it('retorna 400 si el folio nuevo es igual al actual', async () => {
    mockSession.mockResolvedValue({ user: { nombre: 'P', empresas: [1] } } as any);
    mockSql.mockResolvedValueOnce([{ id: 1, folio: '123', empresa_id: 1 }] as any);
    const res = await PATCH(makeReq('123'), { params: { id: '1' } } as any);
    expect(res.status).toBe(400);
  });

  it('actualiza folio, inserta auditoría y devuelve 200 con payload', async () => {
    mockSession.mockResolvedValue({ user: { nombre: 'Pedro', empresas: [1] } } as any);
    mockSql
      .mockResolvedValueOnce([{ id: 1, folio: '123', empresa_id: 1 }] as any) // SELECT despacho
      .mockResolvedValueOnce([{ id: 1, folio: '999' }] as any) // UPDATE RETURNING
      .mockResolvedValueOnce([{ corregido_en: '2026-08-21T10:00:00Z' }] as any); // INSERT audit RETURNING

    const res = await PATCH(makeReq('999'), { params: { id: '1' } } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      id: 1,
      folio_anterior: '123',
      folio_nuevo: '999',
      corregido_por: 'Pedro',
    });
    expect(body.corregido_en).toBeTruthy();

    // UPDATE sobre despachos_bodega
    const updateCall = mockSql.mock.calls[1]?.[0];
    const updateText = asQuery(updateCall);
    expect(updateText).toContain('UPDATE public.despachos_bodega');
    expect(updateText).toContain('folio');

    // INSERT en tabla de auditoría
    const auditCall = mockSql.mock.calls[2]?.[0];
    const auditText = asQuery(auditCall);
    expect(auditText).toContain('INSERT INTO public.despachos_bodega_folio_audit');
  });
});
