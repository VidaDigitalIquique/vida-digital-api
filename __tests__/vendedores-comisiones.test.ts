/**
 * S5a — Fase B: SQL del informe de comisiones y fusion/redondeo (R8).
 * Estado inicial: ROJO (lib/comisiones.ts aun no existe).
 */
import {
  consultaComisiones,
  fetchComisiones,
  leerComisionPct,
} from '@/lib/comisiones';

const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

const HOY = '2026-11-11';

type Agg = { vendedor: string; notas: number; total_usd: number };
type Db = {
  pct?: unknown;
  vidaVendedores?: string[];
  sanjhVendedores?: string[];
  vidaAgg?: Agg[];
  sanjhAgg?: Agg[];
};

function mockDb(db: Db = {}) {
  const {
    pct = 0.5,
    vidaVendedores = [],
    sanjhVendedores = [],
    vidaAgg = [],
    sanjhAgg = [],
  } = db;
  queryMock.mockImplementation((text: unknown) => {
    const t = String(text);
    if (t.includes('public.vendedores_config')) return Promise.resolve([{ pct }]);
    const esLista = t.includes('DISTINCT');
    if (t.includes('vida.movidcto')) {
      return Promise.resolve(
        esLista ? vidaVendedores.map((vendedor) => ({ vendedor })) : vidaAgg
      );
    }
    if (t.includes('sanjh.movidcto')) {
      return Promise.resolve(
        esLista ? sanjhVendedores.map((vendedor) => ({ vendedor })) : sanjhAgg
      );
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('consultaComisiones', () => {
  it('usa las reglas del modulo (fecha de venta futura, tipomovi, tdocu, excluidos)', () => {
    const sql = consultaComisiones('vida');
    expect(sql).toContain('vida.movidcto');
    expect(sql).toContain("m.tipomovi='V'");
    expect(sql).toContain("m.id_tdocu IN ('203','551','554')");
    expect(sql).toMatch(/fechanvt\s*<=\s*\$1::date/);
    expect(sql).toContain("'PABLO BRAVO','EMPRESA'");
    expect(sql).toContain('vida.itemdcto');
    expect(sql).not.toContain('sanjh.itemdcto');
  });

  it('solo facturadas y por mes de fechadoc (rango exclusivo en el limite superior)', () => {
    const sql = consultaComisiones('sanjh');
    expect(sql).toContain("m.pestadot = '3'");
    expect(sql).toMatch(/btrim\(COALESCE\(m\.visaadua/);
    expect(sql).toMatch(/m\.fechadoc\s*>=\s*\$2::date/);
    expect(sql).toMatch(/m\.fechadoc\s*<\s*\$3::date/);
  });

  it('no compara fechadoc con fechanvt: una facturada con factura anterior a la venta cuenta en su mes de facturación', () => {
    const sql = consultaComisiones('vida');
    expect(sql).not.toMatch(/fechadoc\s*(>=|<=|>|<)\s*m\.fechanvt/);
    expect(sql).not.toMatch(/fechanvt\s*(>=|<=|>|<)\s*m\.fechadoc/);
  });

  it('el esquema sale solo del mapa fijo', () => {
    expect(consultaComisiones('vida')).toContain('FROM vida.movidcto m');
    expect(consultaComisiones('sanjh')).toContain('FROM sanjh.movidcto m');
  });
});

describe('fetchComisiones', () => {
  it('una fila por vendedor valido aunque tenga 0 notas, ordenadas por nombre', async () => {
    mockDb({ vidaVendedores: ['PRAVIN', 'ANGELA'], sanjhVendedores: ['JOSEPH LEVANO', 'ANIL CHANDNANI'] });
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas.map((f) => f.vendedor)).toEqual([
      'ANGELA',
      'ANIL CHANDNANI',
      'JOSEPH LEVANO',
      'PRAVIN',
    ]);
    expect(informe.filas.every((f) => f.notas === 0 && f.total_usd === 0 && f.comision_usd === 0)).toBe(true);
    expect(informe.mes).toBe('2026-11');
    expect(informe.mes_etiqueta).toBe('noviembre 2026');
    expect(informe.comision_pct).toBe(0.5);
  });

  it('suma ambas empresas por vendedor (case-insensitive)', async () => {
    mockDb({
      vidaVendedores: ['PRAVIN'],
      sanjhVendedores: [],
      vidaAgg: [{ vendedor: 'PRAVIN', notas: 2, total_usd: 1000 }],
      sanjhAgg: [{ vendedor: 'pravin', notas: 1, total_usd: 500.25 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas).toEqual([
      {
        vendedor: 'PRAVIN',
        notas: 3,
        total_usd: 1500.25,
        comision_pct: 0.5,
        comision_usd: 7.5,
      },
    ]);
  });

  it('un vendedor que solo viene escrito distinto no duplica fila', async () => {
    mockDb({ vidaVendedores: ['PRAVIN', 'Pravin'], sanjhVendedores: [] });
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas).toHaveLength(1);
    expect(informe.filas[0].vendedor).toBe('PRAVIN');
  });

  it('descarta agregados de vendedores excluidos (no estan en la lista del modulo)', async () => {
    mockDb({
      vidaVendedores: ['PRAVIN'],
      vidaAgg: [
        { vendedor: 'PRAVIN', notas: 1, total_usd: 100 },
        { vendedor: 'PABLO BRAVO', notas: 9, total_usd: 9999 },
        { vendedor: 'EMPRESA', notas: 9, total_usd: 9999 },
      ],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas.map((f) => f.vendedor)).toEqual(['PRAVIN']);
    expect(informe.totales.total_usd).toBe(100);
  });

  it('redondea cada fila y el total general es la suma de las filas redondeadas', async () => {
    // 200.8 * 0.5% = 1.004 por fila: redondeadas 1.00 + 1.00 = 2.00 (no 2.01).
    mockDb({
      vidaVendedores: ['ANGELA', 'PRAVIN'],
      vidaAgg: [
        { vendedor: 'ANGELA', notas: 1, total_usd: 200.8 },
        { vendedor: 'PRAVIN', notas: 1, total_usd: 200.8 },
      ],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas.map((f) => f.comision_usd)).toEqual([1, 1]);
    expect(informe.totales.comision_usd).toBe(2);
    expect(informe.totales.total_usd).toBe(401.6);
    expect(informe.totales.notas).toBe(2);
  });

  it('half-up en la comision de una fila con muchos decimales', async () => {
    mockDb({
      vidaVendedores: ['PRAVIN'],
      vidaAgg: [{ vendedor: 'PRAVIN', notas: 1, total_usd: 201 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas[0].comision_usd).toBe(1.01); // 1.005
  });

  it('entrega un objeto con las filas y totales ya calculados (S6 no recalcula)', async () => {
    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaAgg: [{ vendedor: 'ANGELA', notas: 3, total_usd: 10980.1 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe).toEqual({
      mes: '2026-11',
      mes_etiqueta: 'noviembre 2026',
      comision_pct: 0.5,
      filas: [
        { vendedor: 'ANGELA', notas: 3, total_usd: 10980.1, comision_pct: 0.5, comision_usd: 54.9 },
      ],
      totales: { notas: 3, total_usd: 10980.1, comision_usd: 54.9 },
    });
  });

  it('parametriza hoy y el rango del mes en las posiciones de reglasModulo', async () => {
    mockDb({ vidaVendedores: ['PRAVIN'] });
    await fetchComisiones('2026-10', HOY, 0.5);
    const llamada = queryMock.mock.calls.find(
      (c) => String(c[0]).includes('GROUP BY') && String(c[0]).includes('vida.movidcto')
    ) as [string, unknown[]];
    expect(llamada[1]).toEqual([HOY, '2026-10-01', '2026-11-01']);
    const lista = queryMock.mock.calls.find(
      (c) => String(c[0]).includes('DISTINCT') && String(c[0]).includes('sanjh.movidcto')
    ) as [string, unknown[]];
    expect(lista[1]).toEqual([HOY]);
  });

  it('si la base falla, el error sube (la ruta responde 500)', async () => {
    queryMock.mockRejectedValue(new Error('boom'));
    await expect(fetchComisiones('2026-11', HOY, 0.5)).rejects.toThrow('boom');
  });
});

describe('leerComisionPct', () => {
  it('lee el % de la fila unica', async () => {
    mockDb({ pct: 0.5 });
    await expect(leerComisionPct()).resolves.toBe(0.5);
    expect(String(queryMock.mock.calls[0][0])).toContain('public.vendedores_config');
  });

  it('numeric como texto se normaliza a numero', async () => {
    mockDb({ pct: '1.25' });
    await expect(leerComisionPct()).resolves.toBe(1.25);
  });

  it('sin fila o valor invalido -> 0.5 (no captura tabla inexistente)', async () => {
    queryMock.mockResolvedValue([]);
    await expect(leerComisionPct()).resolves.toBe(0.5);
    queryMock.mockResolvedValue([{ pct: 'basura' }]);
    await expect(leerComisionPct()).resolves.toBe(0.5);
  });

  it('tabla inexistente: el error de base sube', async () => {
    queryMock.mockRejectedValue(new Error('relation does not exist'));
    await expect(leerComisionPct()).rejects.toThrow('relation does not exist');
  });
});
