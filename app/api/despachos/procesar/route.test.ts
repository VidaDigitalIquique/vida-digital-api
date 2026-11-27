/**
 * @jest-environment node
 */
// Fase B — /api/despachos/procesar conserva su control de sesion y empresa.
// s25: se retiro el lado muerto de despachos, asi que este test ya no
// compara contra esa ruta.
const getServerSession = jest.fn();
const sqlMock = jest.fn();
const callGeminiTextMock = jest.fn();
const uploadImageMock = jest.fn();

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

jest.mock('@/lib/gemini', () => ({
  callGeminiText: (...args: any[]) => callGeminiTextMock(...args),
}));
jest.mock('@/lib/cloudinary', () => ({
  uploadImage: (...args: any[]) => uploadImageMock(...args),
}));

let procesarPOST: any;

const reqProcesar = () =>
  ({
    json: async () => ({ imageBase64: 'abc', mimeType: 'image/jpeg', empresaId: 2 }),
  } as any);

const sesion = (rol: string, empresas: number[]) => ({ user: { rol, empresas } });

describe('/api/despachos/procesar — autorizacion por sesion y empresa', () => {
  beforeAll(async () => {
    procesarPOST = (await import('./route')).POST;
  });

  beforeEach(() => {
    getServerSession.mockReset();
    sqlMock.mockReset();
    callGeminiTextMock.mockReset();
    uploadImageMock.mockReset();

    callGeminiTextMock.mockResolvedValue('123');
    uploadImageMock.mockResolvedValue({ secure_url: 'https://x/a.jpg', public_id: 'p' });
    sqlMock.mockImplementation(async (strings: any) => {
      if (/SELECT\s+slug/i.test(strings.join('?'))) return [{ slug: 'demo' }];
      return [];
    });
  });

  it('sin sesion: procesar responde 401', async () => {
    getServerSession.mockResolvedValue(null);

    expect((await procesarPOST(reqProcesar())).status).toBe(401);
    expect(callGeminiTextMock).not.toHaveBeenCalled();
    expect(uploadImageMock).not.toHaveBeenCalled();
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('usuario autenticado de OTRA empresa: responde 403 sin llamar IA', async () => {
    getServerSession.mockResolvedValue(sesion('admin', [1]));

    expect((await procesarPOST(reqProcesar())).status).toBe(403);
    expect(callGeminiTextMock).not.toHaveBeenCalled();
    expect(uploadImageMock).not.toHaveBeenCalled();
  });

  it('bodeguero con empresa propia: responde 200 (no 403)', async () => {
    getServerSession.mockResolvedValue(sesion('bodeguero', [2]));

    expect((await procesarPOST(reqProcesar())).status).toBe(200);
  });

  it('usuario autorizado: procesar sigue funcionando con el mismo contrato', async () => {
    getServerSession.mockResolvedValue(sesion('admin', [2]));

    const res = await procesarPOST(reqProcesar());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, folio: '123', imagen_url: 'https://x/a.jpg' });
    expect(callGeminiTextMock).toHaveBeenCalledTimes(1);
    expect(uploadImageMock).toHaveBeenCalledTimes(1);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });
});

export {};
