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
  const url = new URL('http://localhost/api/ventas/clientes');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as Request;
}

describe('GET /api/ventas/clientes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getServerSession.mockResolvedValue(mockSession);
  });

  it('retorna 401 si no hay sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest({ q: 'LILIANA', empresaSlug: 'vida' }));
    expect(res.status).toBe(401);
  });

  it('retorna 400 si falta q', async () => {
    const res = await GET(makeRequest({ empresaSlug: 'vida' }));
    expect(res.status).toBe(400);
  });

  it('retorna 400 si q tiene menos de 2 caracteres', async () => {
    const res = await GET(makeRequest({ q: 'L', empresaSlug: 'vida' }));
    expect(res.status).toBe(400);
  });

  it('retorna 400 si falta empresaSlug', async () => {
    const res = await GET(makeRequest({ q: 'LILIANA' }));
    expect(res.status).toBe(400);
  });

  it('retorna lista de clientes para búsqueda válida', async () => {
    sql.mockResolvedValueOnce([
      {
        kcodclie: 315,
        nombress: 'LILIANA CAMACHO RUIZ',
        rutclien: '14752243',
        digiveri: '6',
        celular: '+56952464570',
        ciudad: 'IQUIQUE',
        pais: 'CHILE',
        comprador: 1,
        foto_url: null,
      },
    ]);
    const res = await GET(makeRequest({ q: 'LILIANA', empresaSlug: 'vida' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].kcodclie).toBe(315);
    expect(body.data[0].nombress).toBe('LILIANA CAMACHO RUIZ');
  });

  it('retorna lista vacía si no hay coincidencias', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await GET(makeRequest({ q: 'ZZZNOENCONTRADO', empresaSlug: 'vida' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it('busca por código numérico exacto', async () => {
    sql.mockResolvedValueOnce([
      {
        kcodclie: 315,
        nombress: 'LILIANA CAMACHO RUIZ',
        rutclien: '14752243',
        digiveri: '6',
        celular: null,
        ciudad: 'IQUIQUE',
        pais: 'CHILE',
        comprador: 1,
        foto_url: null,
      },
    ]);
    const res = await GET(makeRequest({ q: '315', empresaSlug: 'vida' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].kcodclie).toBe(315);
  });
});
