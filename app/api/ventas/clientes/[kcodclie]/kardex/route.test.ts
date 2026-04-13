/**
 * @jest-environment node
 */

import { GET } from './route';

jest.mock('@/lib/db', () => ({
  sql: jest.fn(),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

const { sql } = require('@/lib/db');
const { getServerSession } = require('next-auth');

const mockSession = { user: { rol: 'vendedor', empresas: [2] } };

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/ventas/clientes/315/kardex');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as Request;
}

describe('GET /api/ventas/clientes/[kcodclie]/kardex', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getServerSession.mockResolvedValue(mockSession);
  });

  it('retorna 401 si no hay sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest({ empresaSlug: 'vida' }), {
      params: { kcodclie: '315' },
    });
    expect(res.status).toBe(401);
  });

  it('retorna 400 si falta empresaSlug', async () => {
    const res = await GET(makeRequest({}), {
      params: { kcodclie: '315' },
    });
    expect(res.status).toBe(400);
  });

  it('retorna 200 con cliente y productos para request válido', async () => {
    sql
      .mockResolvedValueOnce([
        {
          kcodclie: 315,
          nombress: 'LILIANA CAMACHO RUIZ',
          foto_url: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          codigo: 'VD-DC-30HE',
          detalle: 'CONDIMENTERO 12PZA',
          fecha: '2025-04-30',
          nvta: '000031',
          cantidad: 9,
          precio: 5.8,
        },
      ])
      .mockResolvedValueOnce([
        {
          codigo: 'VD-DC-30HE',
          imagen_url: null,
          saldo_zofri: 10,
          saldo_bodega: null,
          cantcaja: 9,
        },
      ]);

    const res = await GET(makeRequest({ empresaSlug: 'vida' }), {
      params: { kcodclie: '315' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cliente.kcodclie).toBe(315);
    expect(body.productos).toHaveLength(1);
    expect(body.productos[0].codigo).toBe('VD-DC-30HE');
    expect(body.productos[0].precio_min).toBe(5.8);
  });

  it('retorna productos vacíos si el cliente no tiene compras', async () => {
    sql
      .mockResolvedValueOnce([
        {
          kcodclie: 315,
          nombress: 'LILIANA CAMACHO RUIZ',
          foto_url: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest({ empresaSlug: 'vida' }), {
      params: { kcodclie: '315' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.productos.length).toBe(0);
  });
});
