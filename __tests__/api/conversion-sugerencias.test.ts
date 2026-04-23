/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

const SUGERENCIA = {
  id: 1,
  kcodclie: 100,
  empresa_id: 2,
  nombre_winfac: 'SAMSUNG CHILE',
  score: 0.9,
  estado: 'pendiente',
  created_at: new Date(),
  nombre_lead: 'SAMSUNG',
  whatsapp_lead: '+56912345678',
};

// ─── GET /api/conversion-sugerencias ─────────────────────────────────────────

describe('GET /api/conversion-sugerencias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin sesión → 401', async () => {
    const { GET } = require('@/app/api/conversion-sugerencias/route');

    getServerSession.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/conversion-sugerencias');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  test('con sesión → retorna sugerencias pendientes con JOIN', async () => {
    const { GET } = require('@/app/api/conversion-sugerencias/route');

    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'admin' } });
    sql.mockResolvedValueOnce([SUGERENCIA]);

    const req = new NextRequest('http://localhost/api/conversion-sugerencias');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].nombre_winfac).toBe('SAMSUNG CHILE');
    expect(body.data[0].nombre_lead).toBe('SAMSUNG');
  });

  test('con sesión → lista vacía si no hay pendientes', async () => {
    const { GET } = require('@/app/api/conversion-sugerencias/route');

    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'vendedor' } });
    sql.mockResolvedValueOnce([]);

    const req = new NextRequest('http://localhost/api/conversion-sugerencias');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });
});

// ─── PATCH /api/conversion-sugerencias/[id] ──────────────────────────────────

describe('PATCH /api/conversion-sugerencias/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin sesión → 401', async () => {
    const { PATCH } = require('@/app/api/conversion-sugerencias/[id]/route');

    getServerSession.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/conversion-sugerencias/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'aprobar' }),
    });
    const res = await PATCH(req, { params: { id: '1' } });

    expect(res.status).toBe(401);
  });

  test('con rol vendedor → 403', async () => {
    const { PATCH } = require('@/app/api/conversion-sugerencias/[id]/route');

    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'vendedor' } });

    const req = new NextRequest('http://localhost/api/conversion-sugerencias/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'aprobar' }),
    });
    const res = await PATCH(req, { params: { id: '1' } });

    expect(res.status).toBe(403);
  });

  test('aprobar con rol admin → ejecuta migración y retorna 200', async () => {
    const { PATCH } = require('@/app/api/conversion-sugerencias/[id]/route');

    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'admin' } });
    // 1. SELECT sugerencia
    sql.mockResolvedValueOnce([{ id: 1, cliente_deseado_id: 10, kcodclie: 100, empresa_id: 2 }]);
    // 2. UPDATE productos_deseados → vincular al kcodclie de WinFac
    sql.mockResolvedValueOnce([]);
    // 3. DELETE clientes_deseados → el lead ya es cliente WinFac
    sql.mockResolvedValueOnce([]);
    // 4. UPDATE conversion_sugerencias estado → 'aprobada'
    sql.mockResolvedValueOnce([]);

    const req = new NextRequest('http://localhost/api/conversion-sugerencias/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'aprobar' }),
    });
    const res = await PATCH(req, { params: { id: '1' } });

    expect(res.status).toBe(200);
  });

  test('rechazar con rol admin → retorna 200', async () => {
    const { PATCH } = require('@/app/api/conversion-sugerencias/[id]/route');

    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'admin' } });
    // UPDATE conversion_sugerencias estado → 'rechazada'
    sql.mockResolvedValueOnce([]);

    const req = new NextRequest('http://localhost/api/conversion-sugerencias/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'rechazar' }),
    });
    const res = await PATCH(req, { params: { id: '1' } });

    expect(res.status).toBe(200);
  });
});
