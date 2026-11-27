/**
 * S5a — Fase B: SQL del informe de comisiones y fusion/redondeo (R8).
 * Estado inicial: ROJO (lib/comisiones.ts aun no existe).
 */
import {
  consultaComisiones,
  consultaMargenComisiones,
  fetchComisiones,
  leerComisionPct,
} from '@/lib/comisiones';
import { margenSobreCosto } from '@/lib/comisiones-utils';

const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

const HOY = '2026-11-11';

type Agg = { vendedor: string; notas: number; total_usd: number };
type Margen = { vendedor: string; ganancia_usd: number; costo_usd: number };
type Db = {
  pct?: unknown;
  vidaVendedores?: string[];
  sanjhVendedores?: string[];
  vidaAgg?: Agg[];
  sanjhAgg?: Agg[];
  vidaMargen?: Margen[];
  sanjhMargen?: Margen[];
};

function mockDb(db: Db = {}) {
  const {
    pct = 0.5,
    vidaVendedores = [],
    sanjhVendedores = [],
    vidaAgg = [],
    sanjhAgg = [],
    vidaMargen = [],
    sanjhMargen = [],
  } = db;
  queryMock.mockImplementation((text: unknown) => {
    const t = String(text);
    if (t.includes('public.vendedores_config')) return Promise.resolve([{ pct }]);
    // La consulta de margen tambien contiene "vida.movidcto" e incluso "itemdcto"
    // (reglasModulo la usa en su EXISTS): discriminar por `precread` ANTES.
    if (t.includes('precread')) {
      return Promise.resolve(t.includes('sanjh.movidcto') ? sanjhMargen : vidaMargen);
    }
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

describe('consultaMargenComisiones (s16)', () => {
  it('no selecciona val_rea ni une productos: el JOIN no puede inflar el total vendido', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).not.toContain('val_rea');
    expect(sql).not.toContain('productos');
  });

  it('suma ganancia y costo crudos por vendedor desde las lineas de la nota', () => {
    const sql = consultaMargenComisiones('sanjh');
    expect(sql).toContain('sanjh.itemdcto');
    expect(sql).toContain('i.knumfoli = m.knumfoli');
    expect(sql).toMatch(/SUM\(\(COALESCE\(i\.precread,0\) - COALESCE\(i\.cosunita,0\)\) \* COALESCE\(i\.cantsali,0\)\)/);
    expect(sql).toMatch(/SUM\(COALESCE\(i\.cosunita,0\) \* COALESCE\(i\.cantsali,0\)\)/);
    expect(sql).toContain('GROUP BY 1');
  });

  it('aplica las mismas condiciones de la nota (estado 3, visaadua, rango de fechadoc)', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).toContain("m.pestadot = '3'");
    expect(sql).toMatch(/btrim\(COALESCE\(m\.visaadua/);
    expect(sql).toMatch(/m\.fechadoc\s*>=\s*\$2::date/);
    expect(sql).toMatch(/m\.fechadoc\s*<\s*\$3::date/);
    expect(sql).toContain('vida.movidcto');
  });

  it('excluye de AMBAS sumas las lineas sin costo valido (correccion D13)', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).toContain('COALESCE(i.cosunita,0) > 0');
  });

  it('el esquema sale solo del mapa fijo', () => {
    expect(consultaMargenComisiones('vida')).toContain('FROM vida.movidcto m');
    expect(consultaMargenComisiones('sanjh')).toContain('FROM sanjh.movidcto m');
  });
});

describe('margenSobreCosto (s16)', () => {
  it('ganancia sobre costo en porcentaje, sin redondear', () => {
    expect(margenSobreCosto(320, 1700)).toBeCloseTo(18.823529411764707, 10);
    expect(margenSobreCosto(60, 100)).toBe(60);
  });

  it('costo 0, negativo o no finito -> null (nunca Infinity/NaN)', () => {
    expect(margenSobreCosto(100, 0)).toBeNull();
    expect(margenSobreCosto(100, -5)).toBeNull();
    expect(margenSobreCosto(Infinity, 100)).toBeNull();
    expect(margenSobreCosto(NaN, 100)).toBeNull();
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

describe('fetchComisiones con margen (s16)', () => {
  const MARGEN_A8: Db = {
    vidaVendedores: ['ANGELA', 'PRAVIN'],
    vidaAgg: [
      { vendedor: 'ANGELA', notas: 2, total_usd: 2000 },
      { vendedor: 'PRAVIN', notas: 1, total_usd: 100 },
    ],
    vidaMargen: [
      { vendedor: 'ANGELA', ganancia_usd: 320, costo_usd: 1700 }, // A.8: 18,8235 %
      { vendedor: 'PRAVIN', ganancia_usd: 60, costo_usd: 100 }, // 60 %
    ],
  };

  it('por defecto (sin flag) no incluye la clave y NO ejecuta la consulta de margen', async () => {
    mockDb(MARGEN_A8);
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas.every((f) => !('margen_pct' in f))).toBe(true);
    expect('margen_pct' in informe.totales).toBe(false);
    expect(JSON.stringify(informe)).not.toContain('margen_pct');
    expect(queryMock.mock.calls.some((c) => String(c[0]).includes('precread'))).toBe(false);
  });

  it('con flag: ponderado por costo, NO promedio de porcentajes (A.8)', async () => {
    mockDb(MARGEN_A8);
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    const angela = informe.filas.find((f) => f.vendedor === 'ANGELA')!;
    const pravin = informe.filas.find((f) => f.vendedor === 'PRAVIN')!;

    expect(angela.margen_pct).toBeCloseTo(320 / 1700 * 100, 10); // 18,8235…
    expect(angela.margen_pct).not.toBeCloseTo(16.67, 2); // promedio simple de lineas
    expect(pravin.margen_pct).toBeCloseTo(60, 10);
    // Total ponderado del mes: 380/1800, no el promedio de las filas (39,4).
    expect(informe.totales.margen_pct).toBeCloseTo(380 / 1800 * 100, 10); // 21,1111…
    expect(informe.totales.margen_pct).not.toBeCloseTo(39.4, 1);
  });

  it('divide UNA sola vez tras fusionar vida y sanjh: 100/1000 + 0/1000 = 5 %', async () => {
    mockDb({
      vidaVendedores: ['ANGELA'],
      sanjhVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', ganancia_usd: 100, costo_usd: 1000 }],
      sanjhMargen: [{ vendedor: 'ANGELA', ganancia_usd: 0, costo_usd: 1000 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas).toHaveLength(1);
    expect(informe.filas[0].margen_pct).toBeCloseTo(5, 10);
    expect(informe.totales.margen_pct).toBeCloseTo(5, 10);
  });

  it('"ANGELA" y " angela " de empresas distintas son una fila y suman crudo', async () => {
    mockDb({
      vidaVendedores: ['ANGELA'],
      sanjhVendedores: [' angela '],
      vidaMargen: [{ vendedor: 'ANGELA', ganancia_usd: 300, costo_usd: 1000 }],
      sanjhMargen: [{ vendedor: ' angela ', ganancia_usd: 100, costo_usd: 1000 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas).toHaveLength(1);
    expect(informe.filas[0].margen_pct).toBeCloseTo(20, 10); // 400/2000
  });

  it('costo 0 o vendedor sin lineas -> null serializable, nunca Infinity/NaN', async () => {
    mockDb({
      vidaVendedores: ['ANGELA', 'PRAVIN'],
      vidaMargen: [{ vendedor: 'ANGELA', ganancia_usd: 100, costo_usd: 0 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas.every((f) => f.margen_pct === null)).toBe(true);
    expect(informe.totales.margen_pct).toBeNull();
    expect(() => JSON.stringify(informe)).not.toThrow();
    expect(JSON.stringify(informe)).not.toMatch(/Infinity|NaN/);
  });

  it('duplicar exactamente una linea no cambia el porcentaje (D14)', async () => {
    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', ganancia_usd: 320, costo_usd: 1700 }],
    });
    const base = await fetchComisiones('2026-11', HOY, 0.5, true);

    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', ganancia_usd: 640, costo_usd: 3400 }],
    });
    const duplicado = await fetchComisiones('2026-11', HOY, 0.5, true);

    expect(duplicado.filas[0].margen_pct).toBeCloseTo(base.filas[0].margen_pct!, 10);
  });

  it('con flag: la consulta de margen NO toca val_rea y notas/total/comision no cambian', async () => {
    mockDb(MARGEN_A8);
    const sin = await fetchComisiones('2026-11', HOY, 0.5);
    mockDb(MARGEN_A8);
    const con = await fetchComisiones('2026-11', HOY, 0.5, true);

    expect(con.filas.map(({ margen_pct: _m, ...f }) => f)).toEqual(sin.filas);
    expect(con.totales.notas).toBe(sin.totales.notas);
    expect(con.totales.total_usd).toBe(sin.totales.total_usd);
    expect(con.totales.comision_usd).toBe(sin.totales.comision_usd);
    const margen = queryMock.mock.calls.find((c) => String(c[0]).includes('precread'));
    expect(margen).toBeDefined();
    expect(String(margen![0])).not.toContain('val_rea');
  });

  it('parametriza hoy y el rango del mes en la consulta de margen', async () => {
    mockDb(MARGEN_A8);
    await fetchComisiones('2026-10', HOY, 0.5, true);
    const llamada = queryMock.mock.calls.find(
      (c) => String(c[0]).includes('precread') && String(c[0]).includes('vida.movidcto')
    ) as [string, unknown[]];
    expect(llamada[1]).toEqual([HOY, '2026-10-01', '2026-11-01']);
  });

  it('una linea con costo 0 no infla el numerador (la excluye la consulta)', async () => {
    // El mock simula el WHERE COALESCE(cosunita,0) > 0: la linea sin costo no llega.
    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', ganancia_usd: 320, costo_usd: 1700 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas[0].margen_pct).toBeCloseTo(18.823529411764707, 10);
    expect(consultaMargenComisiones('vida')).toContain('COALESCE(i.cosunita,0) > 0');
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
