/**
 * @jest-environment node
 */
// Fase B — lib/gemini.ts no debe registrar ninguna parte de la API key.
import { callGeminiText } from '../lib/gemini';

const CLAVE = 'CENTINELA_CLAVE_1234567890';
const PREFIJO = CLAVE.substring(0, 8);

function textoDe(args: unknown[]): string {
  return args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
}

describe('lib/gemini — no loguea la API key', () => {
  const spies: jest.SpyInstance[] = [];

  beforeEach(() => {
    process.env.GEMINI_API_KEY_1 = CLAVE;
    process.env.GEMINI_API_KEY_2 = CLAVE;
    process.env.GEMINI_API_KEY_3 = CLAVE;
    spies.length = 0;
    for (const m of ['log', 'error', 'warn', 'info', 'debug'] as const) {
      spies.push(jest.spyOn(console, m).mockImplementation(() => undefined));
    }
    (global as any).fetch = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
      text: async () => 'rate limited',
      json: async () => ({}),
    });
  });

  afterEach(() => {
    for (const s of spies) s.mockRestore();
    delete process.env.GEMINI_API_KEY_1;
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GEMINI_API_KEY_3;
  });

  it('ningun log contiene la clave ni su prefijo', async () => {
    const text = await callGeminiText('hola');

    expect(text).toBeNull();
    // Hay logs de error (429 en cada modelo/key): el test no es vacio.
    expect(spies.some((s) => s.mock.calls.length > 0)).toBe(true);
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        const log = textoDe(call);
        expect(log).not.toContain(CLAVE);
        expect(log).not.toContain(PREFIJO);
      }
    }
  });
});
