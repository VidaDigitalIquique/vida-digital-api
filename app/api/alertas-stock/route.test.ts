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

describe('GET /api/alertas-stock — acceso por rol (regresion)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sql.mockResolvedValue([{ count: 4 }]);
  });

  it.each([
    ['sin sesion', null, 401],
    ['bodeguero', sesion('bodeguero'), 401],
  ])('%s -> %i', async (_nombre, session, status) => {
    getServerSession.mockResolvedValue(session);
    const res = await GET();
    expect(res.status).toBe(status);
  });

  it.each(['admin', 'supervisor', 'vendedor'])('%s -> 200 con count', async (rol) => {
    getServerSession.mockResolvedValue(sesion(rol));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 4 });
  });
});
