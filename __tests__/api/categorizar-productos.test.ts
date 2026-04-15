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

// Helper: consume un ReadableStream SSE y devuelve todos los eventos parseados
async function readStream(response: any): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
  }
  return result;
}

function parseSSEEvents(raw: string): any[] {
  return raw
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => {
      try { return JSON.parse(line.slice(6)); } catch { return null; }
    })
    .filter(Boolean);
}

let GET: any;

describe('GET /api/admin/categorizar-productos', () => {
  beforeAll(async () => {
    process.env.GEMINI_API_KEY_1 = 'test-key-1';
    process.env.GEMINI_API_KEY_2 = 'test-key-2';
    process.env.GEMINI_API_KEY_3 = 'test-key-3';

    if (typeof (global as any).Request === 'undefined') {
      (global as any).Request = class Request {};
    }
    const mod = await import('@/app/api/admin/categorizar-productos/route');
    GET = mod.GET;
  });

  afterAll(() => {
    delete process.env.GEMINI_API_KEY_1;
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GEMINI_API_KEY_3;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    getServerSession.mockReset();
    (global as any).fetch = jest.fn();
  });

  test('retorna 403 si el rol no es admin', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'supervisor', empresas: [2] },
    });

    const req = { url: 'http://localhost/api/admin/categorizar-productos?empresaId=all' } as Request;
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  test('retorna 401 si no hay sesión', async () => {
    getServerSession.mockResolvedValue(null);

    const req = { url: 'http://localhost/api/admin/categorizar-productos?empresaId=all' } as Request;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('Gemini responde correctamente y se guardan categorías', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [1, 2] },
    });

    sqlMock
      .mockResolvedValueOnce([
        { codigo: 'ABC', detalle: 'LICUADORA VIDA DIGITAL' },
        { codigo: 'DEF', detalle: 'SILLA DE RUEDAS ORTOPEDICA' },
      ])
      .mockResolvedValue([]); // UPDATEs

    const geminiBody = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify([
              { codigo: 'ABC', categoria: 'Electrodomésticos' },
              { codigo: 'DEF', categoria: 'Ortopedia' },
            ]),
          }],
        },
      }],
    };

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => geminiBody,
    });

    const req = { url: 'http://localhost/api/admin/categorizar-productos?empresaId=all' } as Request;
    const res = await GET(req);
    expect(res.status).toBe(200);

    const raw = await readStream(res);
    const events = parseSSEEvents(raw);

    const finEvent = events.find((e: any) => e.tipo === 'fin');
    expect(finEvent).toBeDefined();
    expect(finEvent.categorizados).toBeGreaterThanOrEqual(1);
  });

  test('Gemini falla (429) → stream termina con evento fin y errores >= 1', async () => {
    getServerSession.mockResolvedValue({
      user: { rol: 'admin', empresas: [1, 2] },
    });

    sqlMock
      .mockResolvedValueOnce([
        { codigo: 'XYZ', detalle: 'PRODUCTO DE PRUEBA' },
      ])
      .mockResolvedValue([]);

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });

    const req = { url: 'http://localhost/api/admin/categorizar-productos?empresaId=all' } as Request;
    const res = await GET(req);
    expect(res.status).toBe(200);

    const raw = await readStream(res);
    const events = parseSSEEvents(raw);

    const finEvent = events.find((e: any) => e.tipo === 'fin');
    expect(finEvent).toBeDefined();
    expect(finEvent.errores).toBeGreaterThanOrEqual(1);
  });
});
