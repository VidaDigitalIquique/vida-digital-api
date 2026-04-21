/**
 * @jest-environment node
 */

// sql mock: simula tagged template literal (sql`...` → sql(strings, ...values))
const sqlMock = jest.fn();
const sqlTagged = (strings: TemplateStringsArray, ...values: any[]) =>
  sqlMock(strings, ...values);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('syncClientRatings — cálculo de estrellas por país', () => {
  let syncClientRatings: (sql: any) => Promise<{ updated: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-client-ratings');
    syncClientRatings = mod.syncClientRatings;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  // Datos de clientes: cada fila = { kcodclie, pais, promedio_usd }
  // Primera llamada sql → SELECT de promedios
  // Segunda llamada sql → UPSERT de resultados
  const buildSelectResult = (rows: { kcodclie: string; pais: string; promedio_usd: number }[]) =>
    rows;

  test('CHILE promedio 400 USD → 1 estrella', async () => {
    sqlMock
      .mockResolvedValueOnce(buildSelectResult([
        { kcodclie: 'CL001', pais: 'CHILE', promedio_usd: 400 },
      ]))
      .mockResolvedValueOnce([]); // UPSERT

    const result = await syncClientRatings(sqlTagged);
    expect(result.updated).toBe(1);

    const upsertCall = sqlMock.mock.calls[1];
    const upsertValues = upsertCall.slice(1);
    expect(upsertValues).toContain(1); // estrellas = 1
  });

  test('CHILE promedio 1200 USD → 3 estrellas', async () => {
    sqlMock
      .mockResolvedValueOnce(buildSelectResult([
        { kcodclie: 'CL002', pais: 'CHILE', promedio_usd: 1200 },
      ]))
      .mockResolvedValueOnce([]);

    await syncClientRatings(sqlTagged);

    const upsertValues = sqlMock.mock.calls[1].slice(1);
    expect(upsertValues).toContain(3);
  });

  test('PERU promedio 1500 USD → 2 estrellas', async () => {
    sqlMock
      .mockResolvedValueOnce(buildSelectResult([
        { kcodclie: 'PE001', pais: 'PERU', promedio_usd: 1500 },
      ]))
      .mockResolvedValueOnce([]);

    await syncClientRatings(sqlTagged);

    const upsertValues = sqlMock.mock.calls[1].slice(1);
    expect(upsertValues).toContain(2);
  });

  test('PERU promedio 4500 USD → 5 estrellas', async () => {
    sqlMock
      .mockResolvedValueOnce(buildSelectResult([
        { kcodclie: 'PE002', pais: 'PERU', promedio_usd: 4500 },
      ]))
      .mockResolvedValueOnce([]);

    await syncClientRatings(sqlTagged);

    const upsertValues = sqlMock.mock.calls[1].slice(1);
    expect(upsertValues).toContain(5);
  });

  test('BOLIVIA promedio 2000 USD → 2 estrellas', async () => {
    sqlMock
      .mockResolvedValueOnce(buildSelectResult([
        { kcodclie: 'BO001', pais: 'BOLIVIA', promedio_usd: 2000 },
      ]))
      .mockResolvedValueOnce([]);

    await syncClientRatings(sqlTagged);

    const upsertValues = sqlMock.mock.calls[1].slice(1);
    expect(upsertValues).toContain(2);
  });

  test('BOLIVIA promedio 5000 USD → 5 estrellas', async () => {
    sqlMock
      .mockResolvedValueOnce(buildSelectResult([
        { kcodclie: 'BO002', pais: 'BOLIVIA', promedio_usd: 5000 },
      ]))
      .mockResolvedValueOnce([]);

    await syncClientRatings(sqlTagged);

    const upsertValues = sqlMock.mock.calls[1].slice(1);
    expect(upsertValues).toContain(5);
  });

  test('promedio 50 USD (bajo mínimo 100 USD) → 0 estrellas', async () => {
    sqlMock
      .mockResolvedValueOnce(buildSelectResult([
        { kcodclie: 'XX001', pais: 'CHILE', promedio_usd: 50 },
      ]))
      .mockResolvedValueOnce([]);

    await syncClientRatings(sqlTagged);

    const upsertValues = sqlMock.mock.calls[1].slice(1);
    expect(upsertValues).toContain(0);
  });
});

// ─── Test UPSERT ejecutado ────────────────────────────────────────────────────

describe('syncClientRatings — UPSERT ejecutado', () => {
  let syncClientRatings: (sql: any) => Promise<{ updated: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-client-ratings');
    syncClientRatings = mod.syncClientRatings;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  test('ejecuta exactamente un UPSERT contra public.cliente_ratings con los datos correctos', async () => {
    sqlMock
      .mockResolvedValueOnce([
        { kcodclie: 'CL001', pais: 'CHILE', promedio_usd: 1200 },
        { kcodclie: 'PE001', pais: 'PERU',  promedio_usd: 4500 },
      ])
      .mockResolvedValueOnce([]); // UPSERT

    await syncClientRatings(sqlTagged);

    // Debe haberse llamado sql exactamente 2 veces: SELECT + UPSERT
    expect(sqlMock).toHaveBeenCalledTimes(2);

    // La segunda llamada debe referenciar cliente_ratings
    const upsertStrings: string[] = Array.from(sqlMock.mock.calls[1][0] as string[]);
    const upsertTemplate = upsertStrings.join('');
    expect(upsertTemplate).toMatch(/cliente_ratings/i);

    // Los valores del UPSERT deben incluir ambos kcodclie
    const upsertValues = sqlMock.mock.calls[1].slice(1);
    expect(upsertValues).toContain('CL001');
    expect(upsertValues).toContain('PE001');

    // Y las estrellas correspondientes: CL001→3, PE001→5
    expect(upsertValues).toContain(3);
    expect(upsertValues).toContain(5);
  });
});

// ─── Smoke test — retorno ─────────────────────────────────────────────────────

describe('syncClientRatings — smoke test retorno', () => {
  let syncClientRatings: (sql: any) => Promise<{ updated: number }>;

  beforeAll(async () => {
    const mod = await import('@/lib/sync-client-ratings');
    syncClientRatings = mod.syncClientRatings;
  });

  beforeEach(() => {
    sqlMock.mockReset();
  });

  test('retorna { updated: number } donde updated === número de clientes procesados', async () => {
    sqlMock
      .mockResolvedValueOnce([
        { kcodclie: 'CL001', pais: 'CHILE',   promedio_usd: 400  },
        { kcodclie: 'PE001', pais: 'PERU',    promedio_usd: 1500 },
        { kcodclie: 'BO001', pais: 'BOLIVIA', promedio_usd: 5000 },
      ])
      .mockResolvedValueOnce([]);

    const result = await syncClientRatings(sqlTagged);

    expect(result).toHaveProperty('updated');
    expect(typeof result.updated).toBe('number');
    expect(result.updated).toBe(3);
  });

  test('retorna { updated: 0 } si no hay clientes', async () => {
    sqlMock
      .mockResolvedValueOnce([])  // SELECT vacío
      .mockResolvedValueOnce([]); // UPSERT vacío (o no ejecutado)

    const result = await syncClientRatings(sqlTagged);

    expect(result).toHaveProperty('updated');
    expect(result.updated).toBe(0);
  });
});
