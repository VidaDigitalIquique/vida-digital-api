/**
 * D1 — GET/POST /api/catalogos solo para admin y vendedor.
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

jest.mock('@/lib/utils', () => ({ generateSlug: () => 'slug' }));

let GET: any;
let POST: any;

const reqGet = { url: 'http://localhost/api/catalogos?empresa=2' } as Request;
const reqPost = () =>
  ({ json: async () => ({ empresaId: 2, titulo: 'Test' }) } as Request);

describe('/api/catalogos — control de rol', () => {
  beforeAll(async () => {
    const mod = await import('./route');
    GET = mod.GET;
    POST = mod.POST;
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
      const res = await GET(reqGet);
      expect(res.status).toBe(403);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('POST responde 403 y no consulta la base', async () => {
      const res = await POST(reqPost());
      expect(res.status).toBe(403);
      expect(sqlMock).not.toHaveBeenCalled();
    });
  });

  describe.each(['admin', 'vendedor'])('%s', (rol) => {
    beforeEach(() => {
      getServerSession.mockResolvedValue({
        user: { rol, id: 1, empresas: [2] },
      });
      sqlMock.mockResolvedValue([]);
    });

    it('GET no responde 403 por rol', async () => {
      const res = await GET(reqGet);
      expect(res.status).not.toBe(403);
      expect(sqlMock).toHaveBeenCalled();
    });

    it('POST no responde 403 por rol', async () => {
      const res = await POST(reqPost());
      expect(res.status).not.toBe(403);
      expect(sqlMock).toHaveBeenCalled();
    });
  });

  it('sin sesion -> 401', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(reqGet);
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

export {};
