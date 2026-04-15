/**
 * @jest-environment node
 */
const getServerSession = jest.fn();
const sqlMock = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sqlMock(...args),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

let PUT: typeof import('@/app/api/productos/[id]/route').PUT;

describe('PUT /api/productos/[id] — campo categoria', () => {
  beforeAll(async () => {
    if (typeof (global as any).Request === 'undefined') {
      (global as any).Request = class Request {};
    }
    if (typeof (global as any).Response === 'undefined') {
      (global as any).Response = class Response {};
    }
    const mod = await import('@/app/api/productos/[id]/route');
    PUT = mod.PUT;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    getServerSession.mockReset();
  });

  test('supervisor puede actualizar categoria con valor válido', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'supervisor', empresas: [2] },
    });

    sqlMock
      .mockImplementationOnce(() => [{ empresa_id: 2 }])          // SELECT empresa_id
      .mockImplementationOnce(() => [{ id: 1, categoria: 'Belleza' }]); // UPDATE RETURNING

    const req = {
      json: async () => ({ categoria: 'Belleza' }),
    } as Request;

    const res = await PUT(req, { params: { id: '1' } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.categoria).toBe('Belleza');
  });

  test('retorna 400 si la categoria no es un valor permitido', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'supervisor', empresas: [2] },
    });

    sqlMock.mockImplementationOnce(() => [{ empresa_id: 2 }]); // SELECT empresa_id

    const req = {
      json: async () => ({ categoria: 'Inexistente' }),
    } as Request;

    const res = await PUT(req, { params: { id: '1' } });
    expect(res.status).toBe(400);
  });

  test('supervisor puede quitar categoria enviando null', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'supervisor', empresas: [2] },
    });

    sqlMock
      .mockImplementationOnce(() => [{ empresa_id: 2 }])          // SELECT empresa_id
      .mockImplementationOnce(() => [{ id: 1, categoria: null }]); // UPDATE RETURNING

    const req = {
      json: async () => ({ categoria: null }),
    } as Request;

    const res = await PUT(req, { params: { id: '1' } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.categoria).toBeNull();
  });

  test('bodeguero no puede cambiar categoria — retorna 403', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'bodeguero', empresas: [2] },
    });

    const req = {
      json: async () => ({ categoria: 'Deporte' }),
    } as Request;

    const res = await PUT(req, { params: { id: '1' } });
    expect(res.status).toBe(403);
  });
});
