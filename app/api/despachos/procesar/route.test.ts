/**
 * @jest-environment node
 */
// Fase B — /api/despachos/procesar debe tener el MISMO control de sesion y
// empresa que /api/despachos/process.
const getServerSession = jest.fn();
const sqlMock = jest.fn();
const callGeminiTextMock = jest.fn();
const extractFolioMock = jest.fn();
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
jest.mock('@/lib/openrouter', () => ({
  extractFolioFromImage: (...args: any[]) => extractFolioMock(...args),
}));
jest.mock('@/lib/cloudinary', () => ({
  uploadImage: (...args: any[]) => uploadImageMock(...args),
}));

let procesarPOST: any;
let processPOST: any;

const reqProcesar = () =>
  ({
    json: async () => ({ imageBase64: 'abc', mimeType: 'image/jpeg', empresaId: 2 }),
  } as any);

const reqProcess = () =>
  ({
    json: async () => ({ imageBase64: 'abc', empresaId: 2, filename: 'f.jpg' }),
    headers: { get: () => 'auto' },
  } as any);

const sesion = (rol: string, empresas: number[]) => ({ user: { rol, empresas } });

describe('/api/despachos/procesar — misma autorizacion que /api/despachos/process', () => {
  beforeAll(async () => {
    procesarPOST = (await import('./route')).POST;
    processPOST = (await import('../process/route')).POST;
  });

  beforeEach(() => {
    getServerSession.mockReset();
    sqlMock.mockReset();
    callGeminiTextMock.mockReset();
    extractFolioMock.mockReset();
    uploadImageMock.mockReset();

    callGeminiTextMock.mockResolvedValue('123');
    extractFolioMock.mockResolvedValue(123);
    uploadImageMock.mockResolvedValue({ secure_url: 'https://x/a.jpg', public_id: 'p' });
    sqlMock.mockImplementation(async (strings: any) => {
      if (/SELECT\s+slug/i.test(strings.join('?'))) return [{ slug: 'demo' }];
      return [];
    });
  });

  it('sin sesion: procesar y process responden 401', async () => {
    getServerSession.mockResolvedValue(null);

    expect((await procesarPOST(reqProcesar())).status).toBe(401);
    expect((await processPOST(reqProcess())).status).toBe(401);
    expect(callGeminiTextMock).not.toHaveBeenCalled();
    expect(extractFolioMock).not.toHaveBeenCalled();
    expect(uploadImageMock).not.toHaveBeenCalled();
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('usuario autenticado de OTRA empresa: ambos responden 403 sin llamar IA', async () => {
    getServerSession.mockResolvedValue(sesion('admin', [1]));

    const rProcesar = await procesarPOST(reqProcesar());
    const rProcess = await processPOST(reqProcess());

    expect(rProcesar.status).toBe(403);
    expect(rProcess.status).toBe(403);
    expect(callGeminiTextMock).not.toHaveBeenCalled();
    expect(extractFolioMock).not.toHaveBeenCalled();
    expect(uploadImageMock).not.toHaveBeenCalled();
  });

  it('bodeguero con empresa propia: procesar responde igual que process (no 403)', async () => {
    getServerSession.mockResolvedValue(sesion('bodeguero', [2]));

    const rProcesar = await procesarPOST(reqProcesar());
    const rProcess = await processPOST(reqProcess());

    expect(rProcesar.status).toBe(200);
    expect(rProcess.status).toBe(200);
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
