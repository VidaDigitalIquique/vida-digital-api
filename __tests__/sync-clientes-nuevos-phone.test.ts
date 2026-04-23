/**
 * @jest-environment node
 */

import { matchClientesNuevos } from '@/lib/sync-clientes-nuevos';

const sqlMock = jest.fn();
const sqlTagged = (strings: TemplateStringsArray, ...values: any[]) =>
  sqlMock(strings, ...values);

function sqlWasCalledWithTable(table: string): boolean {
  return sqlMock.mock.calls.some((call: any[]) => {
    const segments: string[] = Array.from(call[0] as string[]);
    return segments.join('').toLowerCase().includes(table.toLowerCase());
  });
}

function geminiResponse(payload: object) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(payload) }] },
      }],
    }),
  });
}

describe('matchClientesNuevos — match por teléfono', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY_1 = 'test-key-1';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY_1;
  });

  test('match por teléfono exacto inserta sugerencia con score 0.95 sin llamar Gemini', async () => {
    const nuevo = {
      kcodclie: 1,
      nombre: 'SAMSUNG CHILE',
      empresa_id: 2,
      celular: '59174512563',
    };

    const deseados = [
      {
        id: 10,
        nombre: 'Empresa Distinta',
        whatsapp: '+591 74512563',
      },
    ];

    const result = await matchClientesNuevos(nuevo, deseados, sqlTagged);

    expect(result).toBe(1);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(sqlWasCalledWithTable('conversion_sugerencias')).toBe(true);

    const insertCall = sqlMock.mock.calls.find((call: any[]) => {
      const segments: string[] = Array.from(call[0] as string[]);
      return segments.join('').toLowerCase().includes('conversion_sugerencias');
    });

    expect(insertCall).toBeTruthy();

    const flattenedValues = insertCall ? insertCall.slice(1) : [];
    expect(flattenedValues).toEqual(
      expect.arrayContaining([1, 2, 'SAMSUNG CHILE', 10, 0.95])
    );
  });

  test('sin match por teléfono continúa con heurística de tokens y llama Gemini', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(
      geminiResponse({ match: false, cliente_deseado_id: null, confidence: 0.3 }),
    );

    const nuevo = {
      kcodclie: 1,
      nombre: 'SAMSUNG CHILE',
      empresa_id: 2,
      celular: '59100000000',
    };

    const deseados = [
      {
        id: 10,
        nombre: 'SAMSUNG',
        whatsapp: '+591 74512563',
      },
    ];

    const result = await matchClientesNuevos(nuevo, deseados, sqlTagged);

    expect(result).toBe(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sqlWasCalledWithTable('conversion_sugerencias')).toBe(false);
  });

  test('nuevo sin celular no intenta match por teléfono; sin tokens compartidos retorna 0 sin Gemini ni INSERT', async () => {
    const nuevo = {
      kcodclie: 1,
      nombre: 'CLIENTE NUEVO',
      empresa_id: 2,
      celular: null,
    };

    const deseados = [
      {
        id: 10,
        nombre: 'Empresa Distinta XYZ',
        whatsapp: '59174512563',
      },
    ];

    const result = await matchClientesNuevos(nuevo, deseados, sqlTagged);

    expect(result).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(sqlWasCalledWithTable('conversion_sugerencias')).toBe(false);
  });
});
