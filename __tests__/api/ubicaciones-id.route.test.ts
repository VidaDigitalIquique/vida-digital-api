import { getServerSession } from 'next-auth';

const sqlMock = jest.fn();
let PUT: typeof import('@/app/api/ubicaciones/[id]/route').PUT;

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sqlMock(...args),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('PUT /api/ubicaciones/[id]', () => {
  beforeAll(async () => {
    if (typeof (global as any).Request === 'undefined') {
      (global as any).Request = class Request {};
    }
    if (typeof (global as any).Response === 'undefined') {
      (global as any).Response = class Response {};
    }
    const mod = await import('@/app/api/ubicaciones/[id]/route');
    PUT = mod.PUT;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { empresas: [1] },
    });
  });

  it('allows empty values without COALESCE on ubicacion/observaciones', async () => {
    sqlMock
      .mockImplementationOnce(() => [
        { empresa_id: 1, saldo: 24, cantcaja: 12, ubicacion: 'A1', observaciones: 'Obs1' },
      ])
      .mockImplementationOnce(() => [
        { id: 11, ubicacion: '', observaciones: '', saldo: 24, cantcaja: 12 },
      ]);

    const req = {
      json: async () => ({
        ubicacion: '',
        observaciones: '',
        fisico_cajas: null,
        fisico_unidades: 0,
      }),
    } as Request;

    const res = await PUT(req, { params: { id: '11' } });
    expect(res.status).toBe(200);

    const updateCall = sqlMock.mock.calls[1];
    const [strings] = updateCall;
    expect(strings.join(' ')).not.toMatch(/COALESCE/i);
  });
});
