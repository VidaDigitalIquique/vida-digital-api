/**
 * @jest-environment node
 */

// sql mock: simula tagged template literal (sql`...` → sql(strings, ...values))
const sqlMock = jest.fn();
const sqlTagged = (strings: TemplateStringsArray, ...values: any[]) =>
  sqlMock(strings, ...values);

// ─── Cold start ───────────────────────────────────────────────────────────────

describe('syncClientesNuevos — cold start', () => {
  let syncClientesNuevos: (sql: any) => Promise<{ nuevos: number; sugerencias: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    syncClientesNuevos = mod.syncClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  test('tabla vacía → inserta todos como baseline sin generar sugerencias', async () => {
    // Llamada 1: kcodclie actuales en WinFac (vida + sanjh)
    sqlMock.mockResolvedValueOnce([{ kcodclie: 1 }, { kcodclie: 2 }]);
    // Llamada 2: clientes_conocidos vacío → cold start
    sqlMock.mockResolvedValueOnce([]);
    // Llamada 3: clientes_deseados vacío
    sqlMock.mockResolvedValueOnce([]);
    // Llamada 4: INSERT baseline en clientes_conocidos
    sqlMock.mockResolvedValueOnce([]);

    const result = await syncClientesNuevos(sqlTagged);

    // Cold start: se registra el baseline pero no se cuentan como "nuevos"
    expect(result).toEqual({ nuevos: 0, sugerencias: 0 });
  });
});

// ─── Sin clientes nuevos ───────────────────────────────────────────────────────

describe('syncClientesNuevos — sin clientes nuevos', () => {
  let syncClientesNuevos: (sql: any) => Promise<{ nuevos: number; sugerencias: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    syncClientesNuevos = mod.syncClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  test('clientes_conocidos ya tiene los mismos kcodclie que WinFac → no genera sugerencias', async () => {
    // Llamada 1: WinFac tiene kcodclie 1 y 2
    sqlMock.mockResolvedValueOnce([{ kcodclie: 1 }, { kcodclie: 2 }]);
    // Llamada 2: clientes_conocidos ya tiene los mismos
    sqlMock.mockResolvedValueOnce([{ kcodclie: 1 }, { kcodclie: 2 }]);

    const result = await syncClientesNuevos(sqlTagged);

    expect(result).toEqual({ nuevos: 0, sugerencias: 0 });
  });
});

// ─── Clientes nuevos sin deseados ─────────────────────────────────────────────

describe('syncClientesNuevos — clientes nuevos sin clientes deseados', () => {
  let syncClientesNuevos: (sql: any) => Promise<{ nuevos: number; sugerencias: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    syncClientesNuevos = mod.syncClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  test('kcodclie 3 es nuevo pero clientes_deseados vacío → inserta en conocidos, sugerencias = 0', async () => {
    // Llamada 1: WinFac tiene 1, 2, 3
    sqlMock.mockResolvedValueOnce([{ kcodclie: 1 }, { kcodclie: 2 }, { kcodclie: 3 }]);
    // Llamada 2: clientes_conocidos solo tiene 1 y 2
    sqlMock.mockResolvedValueOnce([{ kcodclie: 1 }, { kcodclie: 2 }]);
    // Llamada 3: clientes_deseados vacío → no hay a quién sugerir
    sqlMock.mockResolvedValueOnce([]);
    // Llamada 4: INSERT kcodclie 3 en clientes_conocidos
    sqlMock.mockResolvedValueOnce([]);

    const result = await syncClientesNuevos(sqlTagged);

    expect(result).toEqual({ nuevos: 1, sugerencias: 0 });
  });
});

// ─── Clientes nuevos con deseados ─────────────────────────────────────────────

describe('syncClientesNuevos — clientes nuevos con clientes deseados', () => {
  let syncClientesNuevos: (sql: any) => Promise<{ nuevos: number; sugerencias: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    syncClientesNuevos = mod.syncClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  test('kcodclie 3 es nuevo y hay clientes_deseados → llama matchClientesNuevos, sugerencias = 0 (stub)', async () => {
    // Llamada 1: WinFac tiene 1, 2, 3
    sqlMock.mockResolvedValueOnce([{ kcodclie: 1 }, { kcodclie: 2 }, { kcodclie: 3 }]);
    // Llamada 2: clientes_conocidos solo tiene 1 y 2
    sqlMock.mockResolvedValueOnce([{ kcodclie: 1 }, { kcodclie: 2 }]);
    // Llamada 3: clientes_deseados tiene 1 registro → se intenta el match
    sqlMock.mockResolvedValueOnce([{ id: 1, nombre: 'Test Cliente', whatsapp: '+56912345678' }]);
    // Llamada 4: INSERT kcodclie 3 en clientes_conocidos
    sqlMock.mockResolvedValueOnce([]);

    const result = await syncClientesNuevos(sqlTagged);

    // matchClientesNuevos (stub en implementación) retorna 0 sugerencias por ahora
    expect(result).toEqual({ nuevos: 1, sugerencias: 0 });
  });
});

// ─── Smoke test — shape del retorno ───────────────────────────────────────────

describe('syncClientesNuevos — smoke test', () => {
  let syncClientesNuevos: (sql: any) => Promise<{ nuevos: number; sugerencias: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-clientes-nuevos');
    syncClientesNuevos = mod.syncClientesNuevos;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  test('retorna siempre un objeto con shape { nuevos: number, sugerencias: number }', async () => {
    // Sin clientes en WinFac ni en conocidos → caso mínimo
    sqlMock.mockResolvedValueOnce([]);  // WinFac vacío
    sqlMock.mockResolvedValueOnce([]);  // conocidos vacío (cold start trivial)
    sqlMock.mockResolvedValueOnce([]);  // deseados vacío
    sqlMock.mockResolvedValueOnce([]);  // INSERT vacío

    const result = await syncClientesNuevos(sqlTagged);

    expect(result).toHaveProperty('nuevos');
    expect(result).toHaveProperty('sugerencias');
    expect(typeof result.nuevos).toBe('number');
    expect(typeof result.sugerencias).toBe('number');
  });
});
