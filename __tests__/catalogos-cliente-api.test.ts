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

// ---------------------------------------------------------------------------

describe('POST /api/catalogos/cliente — crear catálogo por cliente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'admin', empresas: [1, 2] } });
  });

  test('Test 1 — crea catálogo con campos correctos', async () => {
    const { POST } = require('@/app/api/catalogos/cliente/route');

    sql.mockResolvedValueOnce([
      { id: 99, slug: 'test-cliente-12345', titulo: 'Test', kcodclie: 'CLI001', tipo_precio: 'max' },
    ]);

    const req = new NextRequest('http://localhost/api/catalogos/cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaId: 2,
        titulo: 'Catálogo CLI001',
        kcodclie: 'CLI001',
        tipo_precio: 'max',
        solo_stock: true,
        margen_precio: 0,
        mostrar_precio: true,
        ambas_empresas: true,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.kcodclie).toBe('CLI001');
  });

  test('Test 2 — falla si falta kcodclie', async () => {
    const { POST } = require('@/app/api/catalogos/cliente/route');

    const req = new NextRequest('http://localhost/api/catalogos/cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: 2, titulo: 'Test' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe('GET /api/catalogos/cliente/[slug] — catálogo público por cliente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'admin', empresas: [1, 2] } });
  });

  test('Test 3 — retorna productos con precio_max del cliente', async () => {
    const { GET } = require('@/app/api/catalogos/cliente/[slug]/route');

    sql
      .mockResolvedValueOnce([
        {
          id: 1,
          slug: 'test-slug',
          titulo: 'Cat CLI',
          kcodclie: 'CLI001',
          tipo_precio: 'max',
          solo_stock: false,
          ambas_empresas: true,
          empresa_id: 2,
          empresa_slug: 'vida-digital',
          activo: true,
          mostrar_precio: true,
          margen_precio: 0,
        },
      ])
      .mockResolvedValueOnce([
        { codigo: 'P001', precio: 100 },
        { codigo: 'P001', precio: 120 },
        { codigo: 'P002', precio: 50 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { codigo: 'P001', detalle: 'Producto 1', imagen_url: null, cantcaja: 6,  umed: 'UN', costo: 80, saldo: 10 },
        { codigo: 'P002', detalle: 'Producto 2', imagen_url: null, cantcaja: 12, umed: 'UN', costo: 40, saldo: 5  },
      ]);

    const req = new NextRequest('http://localhost/api/catalogos/cliente/test-slug');
    const res = await GET(req, { params: { slug: 'test-slug' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.productos.length).toBe(2);

    const p001 = body.data.productos.find((p: any) => p.codigo === 'P001');
    expect(p001.precio_catalogo).toBe(120);
  });

  test('Test 4 — tipo_precio "min" usa el precio mínimo', async () => {
    const { GET } = require('@/app/api/catalogos/cliente/[slug]/route');

    sql
      .mockResolvedValueOnce([
        {
          id: 1,
          slug: 'test-slug',
          titulo: 'Cat CLI',
          kcodclie: 'CLI001',
          tipo_precio: 'min',
          solo_stock: false,
          ambas_empresas: true,
          empresa_id: 2,
          empresa_slug: 'vida-digital',
          activo: true,
          mostrar_precio: true,
          margen_precio: 0,
        },
      ])
      .mockResolvedValueOnce([
        { codigo: 'P001', precio: 100 },
        { codigo: 'P001', precio: 120 },
        { codigo: 'P002', precio: 50 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { codigo: 'P001', detalle: 'Producto 1', imagen_url: null, cantcaja: 6,  umed: 'UN', costo: 80, saldo: 10 },
        { codigo: 'P002', detalle: 'Producto 2', imagen_url: null, cantcaja: 12, umed: 'UN', costo: 40, saldo: 5  },
      ]);

    const req = new NextRequest('http://localhost/api/catalogos/cliente/test-slug');
    const res = await GET(req, { params: { slug: 'test-slug' } });
    const body = await res.json();

    expect(res.status).toBe(200);

    const p001 = body.data.productos.find((p: any) => p.codigo === 'P001');
    expect(p001.precio_catalogo).toBe(100);
  });
});
