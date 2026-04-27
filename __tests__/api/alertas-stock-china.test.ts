/**
 * @jest-environment node
 */

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

import { GET } from '../../app/api/alertas-stock/lista/route';

describe('GET /api/alertas-stock/lista — modo China', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({
      user: { rol: 'admin' }
    });
  });

  it('devuelve total_clientes como número entero, no string', async () => {
    sql.mockResolvedValue([
      { codigo: 'A-618', saldo: 1, activa: true, total_clientes: 33 }
    ]);
    const res = await GET();
    const body = await res.json();
    expect(typeof body.data[0].total_clientes).toBe('number');
  });

  it('devuelve array ordenado por total_clientes DESC', async () => {
    sql.mockResolvedValue([
      { codigo: 'A-618', total_clientes: 33 },
      { codigo: 'HS-1807P', total_clientes: 31 },
      { codigo: 'H-05', total_clientes: 10 },
    ]);
    const res = await GET();
    const body = await res.json();
    const clientes = body.data.map((r: any) => r.total_clientes);
    expect(clientes).toEqual([...clientes].sort((a, b) => b - a));
  });

  it('retorna 401 si no hay sesión', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
