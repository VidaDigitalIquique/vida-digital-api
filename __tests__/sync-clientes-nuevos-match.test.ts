/**
 * @jest-environment node
 */

// sql mock: simula tagged template literal (sql`...` → sql(strings, ...values))
const sqlMock = jest.fn();
const sqlTagged = (strings: TemplateStringsArray, ...values: any[]) =>
  sqlMock(strings, ...values);

// Verifica si sqlMock fue llamado con INSERT en una tabla específica
function sqlWasCalledWithTable(table: string): boolean {
  return sqlMock.mock.calls.some((call: any[]) => {
    const segments: string[] = Array.from(call[0] as string[]);
    return segments.join('').toLowerCase().includes(table.toLowerCase());
  });
}

// Construye la respuesta JSON que devuelve Gemini
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

// ─── Sin candidatos heurísticos ───────────────────────────────────────────────

describe('matchClientesNuevos — sin candidatos heurísticos', () => {
  let matchClientesNuevos: (
    nuevo: { kcodclie: number; nombre: string; empresa_id: number },
    deseados: { id: number; nombre: string }[],
    sql: any,
  ) => Promise<number>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    matchClientesNuevos = (mod as any).matchClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    global.fetch = jest.fn();
  });

  test('sin tokens compartidos → no llama a Gemini, retorna 0', async () => {
    const nuevo   = { kcodclie: 1, nombre: 'ELECTRONICA SAMSUNG', empresa_id: 2 };
    const deseados = [{ id: 10, nombre: 'FERRETERIA NORTE' }];

    const result = await matchClientesNuevos(nuevo, deseados, sqlTagged);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});

// ─── Gemini confirma match ─────────────────────────────────────────────────────

describe('matchClientesNuevos — Gemini confirma match', () => {
  let matchClientesNuevos: (
    nuevo: { kcodclie: number; nombre: string; empresa_id: number },
    deseados: { id: number; nombre: string }[],
    sql: any,
  ) => Promise<number>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    matchClientesNuevos = (mod as any).matchClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY_1 = 'test-key-1';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY_1;
  });

  test('token SAMSUNG compartido + Gemini confidence 0.9 → inserta sugerencia, retorna 1', async () => {
    const nuevo    = { kcodclie: 1, nombre: 'SAMSUNG CHILE', empresa_id: 2 };
    const deseados = [{ id: 10, nombre: 'SAMSUNG' }];

    (global.fetch as jest.Mock).mockReturnValueOnce(
      geminiResponse({ match: true, cliente_deseado_id: 10, confidence: 0.9 }),
    );
    // INSERT en conversion_sugerencias
    sqlMock.mockResolvedValueOnce([]);

    const result = await matchClientesNuevos(nuevo, deseados, sqlTagged);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sqlWasCalledWithTable('conversion_sugerencias')).toBe(true);
    expect(result).toBe(1);
  });
});

// ─── Gemini niega match ────────────────────────────────────────────────────────

describe('matchClientesNuevos — Gemini niega match', () => {
  let matchClientesNuevos: (
    nuevo: { kcodclie: number; nombre: string; empresa_id: number },
    deseados: { id: number; nombre: string }[],
    sql: any,
  ) => Promise<number>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    matchClientesNuevos = (mod as any).matchClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY_1 = 'test-key-1';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY_1;
  });

  test('token SAMSUNG compartido + Gemini confidence 0.3 → no inserta, retorna 0', async () => {
    const nuevo    = { kcodclie: 1, nombre: 'SAMSUNG CHILE', empresa_id: 2 };
    const deseados = [{ id: 10, nombre: 'SAMSUNG PERU' }];

    (global.fetch as jest.Mock).mockReturnValueOnce(
      geminiResponse({ match: false, cliente_deseado_id: null, confidence: 0.3 }),
    );

    const result = await matchClientesNuevos(nuevo, deseados, sqlTagged);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sqlWasCalledWithTable('conversion_sugerencias')).toBe(false);
    expect(result).toBe(0);
  });
});

// ─── Gemini confidence insuficiente ───────────────────────────────────────────

describe('matchClientesNuevos — confidence por debajo del umbral', () => {
  let matchClientesNuevos: (
    nuevo: { kcodclie: number; nombre: string; empresa_id: number },
    deseados: { id: number; nombre: string }[],
    sql: any,
  ) => Promise<number>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    matchClientesNuevos = (mod as any).matchClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY_1 = 'test-key-1';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY_1;
  });

  test('match=true pero confidence 0.5 < 0.7 → no inserta, retorna 0', async () => {
    const nuevo    = { kcodclie: 1, nombre: 'SAMSUNG CHILE', empresa_id: 2 };
    const deseados = [{ id: 10, nombre: 'SAMSUNG DISTRIBUIDOR' }];

    (global.fetch as jest.Mock).mockReturnValueOnce(
      geminiResponse({ match: true, cliente_deseado_id: 10, confidence: 0.5 }),
    );

    const result = await matchClientesNuevos(nuevo, deseados, sqlTagged);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sqlWasCalledWithTable('conversion_sugerencias')).toBe(false);
    expect(result).toBe(0);
  });
});

// ─── Gemini falla ─────────────────────────────────────────────────────────────

describe('matchClientesNuevos — error en fetch', () => {
  let matchClientesNuevos: (
    nuevo: { kcodclie: number; nombre: string; empresa_id: number },
    deseados: { id: number; nombre: string }[],
    sql: any,
  ) => Promise<number>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    matchClientesNuevos = (mod as any).matchClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY_1 = 'test-key-1';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY_1;
  });

  test('fetch lanza error → no inserta, retorna 0 sin propagar', async () => {
    const nuevo    = { kcodclie: 1, nombre: 'SAMSUNG CHILE', empresa_id: 2 };
    const deseados = [{ id: 10, nombre: 'SAMSUNG' }];

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      matchClientesNuevos(nuevo, deseados, sqlTagged),
    ).resolves.toBe(0);

    expect(sqlWasCalledWithTable('conversion_sugerencias')).toBe(false);
  });
});
