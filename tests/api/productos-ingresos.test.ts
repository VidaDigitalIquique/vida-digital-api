import { describe, expect, it, vi, beforeAll } from 'vitest';

// Mock next-auth antes de importar el handler
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: '1', rol: 'admin' } }),
}));

// Mock next/headers para evitar el error de request scope
vi.mock('next/headers', () => ({
  headers: vi.fn().mockReturnValue(new Map()),
  cookies: vi.fn().mockReturnValue(new Map()),
}));

import { GET } from '@/app/api/productos/ingresos/route';

describe('GET /api/productos/ingresos', () => {
  it('sin parámetro codigo -> responde 400', async () => {
    const request = new Request('http://localhost/api/productos/ingresos');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('con codigo válido -> responde 200 con array data', async () => {
    const request = new Request('http://localhost/api/productos/ingresos?codigo=TEST');
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('cada item del array tiene campos: nroingreso, costo, fecha_ingreso, saldo, empresa_id', async () => {
    const request = new Request('http://localhost/api/productos/ingresos?codigo=TEST');
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      const item = body.data[0];
      expect(item).toHaveProperty('nroingreso');
      expect(item).toHaveProperty('costo');
      expect(item).toHaveProperty('fecha_ingreso');
      expect(item).toHaveProperty('saldo');
      expect(item).toHaveProperty('empresa_id');
    }
  });
});
