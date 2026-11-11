/**
 * D1 — GET/PUT/DELETE /api/catalogos/[id] solo para admin y vendedor.
 * Estado inicial: ROJO (falta el chequeo de rol).
 */
const getServerSession = jest.fn();
const sqlMock = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sqlMock(...args),
}));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

let GET: any;
let PUT: any;
let DELETE: any;

const params = { params: { id: '10' } };
const reqGet = { url: 'http://localhost/api/catalogos/10' } as Request;
const reqPut = () => ({ json: async () => ({ titulo: 'X' }) } as Request);
const reqDel = { url: 'http://localhost/api/catalogos/10' } as Request;

describe('/api/catalogos/[id] — control de rol', () => {
  beforeAll(async () => {
    const mod = await import('./route');
    GET = mod.GET;
    PUT = mod.PUT;
    DELETE = mod.DELETE;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    getServerSession.mockReset();
  });

  describe('bodeguero', () => {
    beforeEach(() => {
      getServerSession.mockResolvedValue({
        user: { rol: 'bodeguero', id: 1, empresas: [2] },
      });
    });

    it('GET responde 403 y no consulta la base', async () => {
      const res = await GET(reqGet, params);
      expect(res.status).toBe(403);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('PUT responde 403 y no consulta la base', async () => {
      const res = await PUT(reqPut(), params);
      expect(res.status).toBe(403);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('DELETE responde 403 y no consulta la base', async () => {
      const res = await DELETE(reqDel, params);
      expect(res.status).toBe(403);
      expect(sqlMock).not.toHaveBeenCalled();
    });
  });

  describe.each(['admin', 'vendedor'])('%s', (rol) => {
    beforeEach(() => {
      getServerSession.mockResolvedValue({
        user: { rol, id: 1, empresas: [2] },
      });
    });

    it('GET no responde 403 por rol', async () => {
      sqlMock.mockResolvedValueOnce([{ empresa_id: 2, user_id: 1 }]);
      sqlMock.mockResolvedValueOnce([]);
      const res = await GET(reqGet, params);
      expect(res.status).not.toBe(403);
      expect(sqlMock).toHaveBeenCalled();
    });

    it('PUT no responde 403 por rol', async () => {
      sqlMock.mockResolvedValueOnce([{ empresa_id: 2, user_id: 1 }]);
      sqlMock.mockResolvedValue([]);
      const res = await PUT(reqPut(), params);
      expect(res.status).not.toBe(403);
      expect(sqlMock).toHaveBeenCalled();
    });

    it('DELETE no responde 403 por rol', async () => {
      sqlMock.mockResolvedValueOnce([{ empresa_id: 2, user_id: 1 }]);
      sqlMock.mockResolvedValue([]);
      const res = await DELETE(reqDel, params);
      expect(res.status).not.toBe(403);
      expect(sqlMock).toHaveBeenCalled();
    });
  });

  it('sin sesion -> 401', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(reqGet, params);
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

export {};
