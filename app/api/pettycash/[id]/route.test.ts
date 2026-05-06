import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH, DELETE } from './route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockSession = vi.mocked(getServerSession);

const admin    = { user: { name: 'Admin',    rol: 'admin'         } };
const vendedor = { user: { name: 'Vendedor', rol: 'vendedor'      } };

function makeReq(method: string, body?: object) {
  return new Request('http://localhost/api/pettycash/1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

const ctx = { params: { id: '1' } };

describe('PATCH /api/pettycash/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 — actualiza registro para admin', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql.mockResolvedValueOnce([{ id: 1, concepto: 'Taxi', monto: 5000 }] as any);

    const res = await PATCH(makeReq('PATCH', { concepto: 'Taxi', monto: 5000 }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.concepto).toBe('Taxi');
  });

  it('403 — rechaza no-administrador', async () => {
    mockSession.mockResolvedValue(vendedor as any);
    const res = await PATCH(makeReq('PATCH', { monto: 100 }), ctx);
    expect(res.status).toBe(403);
  });

  it('404 — registro no encontrado', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql.mockResolvedValueOnce([] as any);
    const res = await PATCH(makeReq('PATCH', { monto: 999 }), ctx);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/pettycash/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 — elimina registro para admin', async () => {
    mockSession.mockResolvedValue(admin as any);
    mockSql.mockResolvedValueOnce([{ id: 1 }] as any);
    const res = await DELETE(makeReq('DELETE'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
  });

  it('403 — rechaza no-administrador', async () => {
    mockSession.mockResolvedValue(vendedor as any);
    const res = await DELETE(makeReq('DELETE'), ctx);
    expect(res.status).toBe(403);
  });
});
