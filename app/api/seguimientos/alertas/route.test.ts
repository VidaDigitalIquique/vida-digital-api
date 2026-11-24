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

import { GET } from './route';

const sesion = (rol: string) => ({ user: { rol } });

describe('GET /api/seguimientos/alertas — acceso por rol (regresion)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sql.mockResolvedValue([{ count: 5 }]);
  });

  it('sin sesion -> 401 (no 403)', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it.each(['bodeguero', 'supervisor'])('%s -> 403', async (rol) => {
    getServerSession.mockResolvedValue(sesion(rol));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it.each(['admin', 'vendedor'])('%s -> 200 con count', async (rol) => {
    getServerSession.mockResolvedValue(sesion(rol));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 5 });
  });
});
