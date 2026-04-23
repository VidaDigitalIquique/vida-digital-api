/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/prenotas/route';
import { GET as GET_DETAIL, PATCH, DELETE } from '@/app/api/prenotas/[id]/route';
import { POST as POST_ITEM } from '@/app/api/prenotas/[id]/items/route';
import { PATCH as PATCH_ITEM, DELETE as DELETE_ITEM } from '@/app/api/prenotas/[id]/items/[itemId]/route';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

describe('GET /api/prenotas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin sesión → 401', async () => {
    getServerSession.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/prenotas');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: expect.any(String) });
  });

  test('con rol bodeguero → 403', async () => {
    getServerSession.mockResolvedValue({ user: { rol: 'bodeguero' } });

    const req = new NextRequest('http://localhost/api/prenotas');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: expect.any(String) });
  });

  test('con sesión válida → retorna lista de prenotas del usuario', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'vendedor' } });
    sql.mockResolvedValue([
      { id: 1, titulo: 'PRE-NOTA JUAN', user_id: 7, kcodclie: 100, nombre_cliente: 'JUAN PEREZ' },
    ]);

    const req = new NextRequest('http://localhost/api/prenotas');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      data: [
        { id: 1, titulo: 'PRE-NOTA JUAN', user_id: 7, kcodclie: 100, nombre_cliente: 'JUAN PEREZ' },
      ],
    });
  });
});

describe('POST /api/prenotas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('con sesión válida → crea prenota y retorna objeto con id y titulo', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'vendedor' } });
    sql.mockResolvedValue([{ id: 10, titulo: 'PRE-NOTA NUEVA' }]);

    const req = new NextRequest('http://localhost/api/prenotas', {
      method: 'POST',
      body: JSON.stringify({ titulo: 'PRE-NOTA NUEVA' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: 10, titulo: 'PRE-NOTA NUEVA' });
  });
});

describe('GET /api/prenotas/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('con sesión válida → retorna prenota con items', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'admin' } });
    sql
      .mockResolvedValueOnce([{ id: 10, titulo: 'PRE-NOTA JUAN', kcodclie: 100, nombre_cliente: 'JUAN PEREZ' }])
      .mockResolvedValueOnce([{ id: 1, codigo: 'ABC123', detalle: 'Producto Test', cajas: 2, unidades: 12, precio: 150 }]);

    const req = new NextRequest('http://localhost/api/prenotas/10');
    const res = await GET_DETAIL(req, { params: { id: '10' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: 10,
      titulo: 'PRE-NOTA JUAN',
      kcodclie: 100,
      nombre_cliente: 'JUAN PEREZ',
      items: [
        { id: 1, codigo: 'ABC123', detalle: 'Producto Test', cajas: 2, unidades: 12, precio: 150 },
      ],
    });
  });
});

describe('PATCH /api/prenotas/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('asignar cliente → actualiza kcodclie, nombre_cliente y titulo', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'vendedor' } });
    sql.mockResolvedValue([
      { id: 10, kcodclie: 100, nombre_cliente: 'JUAN PEREZ', titulo: 'PRE-NOTA JUAN PEREZ' },
    ]);

    const req = new NextRequest('http://localhost/api/prenotas/10', {
      method: 'PATCH',
      body: JSON.stringify({ kcodclie: 100, nombre_cliente: 'JUAN PEREZ', titulo: 'PRE-NOTA JUAN PEREZ' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: { id: '10' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: 10,
      kcodclie: 100,
      nombre_cliente: 'JUAN PEREZ',
      titulo: 'PRE-NOTA JUAN PEREZ',
    });
  });
});

describe('DELETE /api/prenotas/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('con sesión válida → elimina prenota y retorna ok', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'admin' } });
    sql.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/prenotas/10', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: '10' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});

describe('POST /api/prenotas/[id]/items', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('agrega item → retorna item creado', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'vendedor' } });
    sql.mockResolvedValue([
      { id: 55, codigo: 'ABC123', detalle: 'Producto Test', cajas: 1, unidades: 6, precio: 150 },
    ]);

    const req = new NextRequest('http://localhost/api/prenotas/10/items', {
      method: 'POST',
      body: JSON.stringify({ codigo: 'ABC123', detalle: 'Producto Test', cajas: 1, unidades: 6, precio: 150 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST_ITEM(req, { params: { id: '10' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: 55, codigo: 'ABC123', detalle: 'Producto Test', cajas: 1, unidades: 6, precio: 150 });
  });
});

describe('PATCH /api/prenotas/[id]/items/[itemId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('actualiza cajas/unidades/precio → retorna item actualizado', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'vendedor' } });
    sql.mockResolvedValue([
      { id: 55, cajas: 3, unidades: 18, precio: 145 },
    ]);

    const req = new NextRequest('http://localhost/api/prenotas/10/items/55', {
      method: 'PATCH',
      body: JSON.stringify({ cajas: 3, unidades: 18, precio: 145 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH_ITEM(req, { params: { id: '10', itemId: '55' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: 55, cajas: 3, unidades: 18, precio: 145 });
  });
});

describe('DELETE /api/prenotas/[id]/items/[itemId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('elimina item → retorna ok', async () => {
    getServerSession.mockResolvedValue({ user: { id: '7', rol: 'admin' } });
    sql.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/prenotas/10/items/55', { method: 'DELETE' });
    const res = await DELETE_ITEM(req, { params: { id: '10', itemId: '55' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});
