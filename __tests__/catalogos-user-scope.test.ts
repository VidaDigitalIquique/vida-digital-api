const { TextDecoder, TextEncoder } = require('util');

(global as any).TextDecoder = TextDecoder;
(global as any).TextEncoder = TextEncoder;

class MockRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  private body?: string;

  constructor(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
    this.url = url;
    this.method = init.method;
    this.headers = init.headers;
    this.body = init.body;
  }

  async json() {
    return this.body ? JSON.parse(this.body) : {};
  }
}

(global as any).Request = MockRequest;

const sqlMock = jest.fn().mockImplementation((...args: any[]) => Promise.resolve([]));
jest.mock('@/lib/db', () => ({ sql: (...args: any[]) => sqlMock(...args) }));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({ body, init }),
  },
}));

const { getServerSession } = require('next-auth');
const { GET: getCatalogos, POST: postCatalogos } = require('@/app/api/catalogos/route');
const { GET: getCatalogoById } = require('@/app/api/catalogos/[id]/route');

describe('Catalogos user scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/catalogos filters by user_id', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: '123', empresas: [1] },
    });

    const req = new Request('http://localhost/api/catalogos?empresa=1');
    await getCatalogos(req);

    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain('123');
  });

  test('GET /api/catalogos/[id] checks user_id ownership', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: '123', empresas: [1] },
    });

    const req = new Request('http://localhost/api/catalogos/10');
    await getCatalogoById(req, { params: { id: '10' } });

    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain('123');
  });

  test('POST /api/catalogos persists user_id', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: '123', empresas: [1] },
    });

    const req = new Request('http://localhost/api/catalogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaId: 1,
        titulo: 'Catálogo test',
      }),
    });

    await postCatalogos(req);

    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain('123');
  });
});
