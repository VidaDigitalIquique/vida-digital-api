/**
 * S5a — Fase B: SQL del informe de comisiones y fusion/redondeo (R8).
 * Estado inicial: ROJO (lib/comisiones.ts aun no existe).
 */
import {
  COSTO_MINIMO_VALIDO,
  consultaComisiones,
  consultaMargenComisiones,
  fetchComisiones,
  leerComisionPct,
} from '@/lib/comisiones';
import { margenPromedioLineas } from '@/lib/comisiones-utils';

const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

const HOY = '2026-11-11';

type Agg = { vendedor: string; notas: number; total_usd: number };
type Margen = { vendedor: string; suma_pct: number; n_lineas: number };
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

describe('consultaMargenComisiones (s17: promedio simple por linea)', () => {
  it('no selecciona val_rea ni une productos: el JOIN no puede inflar el total vendido', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).not.toContain('val_rea');
    expect(sql).not.toContain('productos');
  });

  it('devuelve SUMA de porcentajes por linea y COUNT de lineas, no ganancia/costo', () => {
    const sql = consultaMargenComisiones('sanjh');
    expect(sql).toContain('sanjh.itemdcto');
    expect(sql).toContain('i.knumfoli = m.knumfoli');
    // Porcentaje de CADA linea: (precio - costo) / costo * 100.
    expect(sql).toContain('i.precread - i.cosunita');
    expect(sql).toMatch(/\/\s*i\.cosunita::float8/);
    expect(sql).toContain('* 100');
    expect(sql).toContain('COUNT(*)::int AS n_lineas');
    expect(sql).toContain('SUM(');
    expect(sql).toContain('GROUP BY 1');
  });

  it('NO usa cantsali: la cantidad vendida no pondera el promedio (s17)', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).not.toContain('cantsali');
  });

  it('aplica las mismas condiciones de la nota (estado 3, visaadua, rango de fechadoc)', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).toContain("m.pestadot = '3'");
    expect(sql).toMatch(/btrim\(COALESCE\(m\.visaadua/);
    expect(sql).toMatch(/m\.fechadoc\s*>=\s*\$2::date/);
    expect(sql).toMatch(/m\.fechadoc\s*<\s*\$3::date/);
    expect(sql).toContain('vida.movidcto');
  });

  it('excluye de AMBAS (suma y conteo) las lineas con costo invalido o precio NULL (s17)', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).toContain('i.cosunita > 0.01');
    expect(sql).toContain('i.precread IS NOT NULL');
    // precread 0 SI cuenta (-100 %): COALESCE(precread,0) convertiria NULL en -100 y lo contaria.
    expect(sql).not.toMatch(/COALESCE\(i\.precread/);
  });

  it('s19: excluye el costo placeholder <= 0,01 (ya no basta > 0) sin volver a COALESCE', () => {
    const sql = consultaMargenComisiones('vida');
    expect(sql).toContain('i.cosunita > 0.01');
    expect(sql).not.toContain('COALESCE(i.cosunita,0) > 0');
    expect(COSTO_MINIMO_VALIDO).toBe(0.01);
  });

  it('el esquema sale solo del mapa fijo', () => {
    expect(consultaMargenComisiones('vida')).toContain('FROM vida.movidcto m');
    expect(consultaMargenComisiones('sanjh')).toContain('FROM sanjh.movidcto m');
  });
});

describe('margenPromedioLineas (s17)', () => {
  it('division por la cantidad de lineas, sin redondear', () => {
    expect(margenPromedioLineas(90, 3)).toBe(30); // 10 + 20 + 60
    expect(margenPromedioLineas(60, 1)).toBe(60);
    expect(margenPromedioLineas(-100, 1)).toBe(-100); // precread 0 cuenta
  });

  it('sin lineas o valores no finitos -> null (nunca Infinity/NaN)', () => {
    expect(margenPromedioLineas(100, 0)).toBeNull();
    expect(margenPromedioLineas(100, -1)).toBeNull();
    expect(margenPromedioLineas(Infinity, 1)).toBeNull();
    expect(margenPromedioLineas(NaN, 1)).toBeNull();
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

describe('fetchComisiones con margen (s17: promedio simple por linea)', () => {
  const MARGEN_LINEAS: Db = {
    vidaVendedores: ['ANGELA', 'PRAVIN'],
    vidaAgg: [
      { vendedor: 'ANGELA', notas: 2, total_usd: 2000 },
      { vendedor: 'PRAVIN', notas: 1, total_usd: 100 },
    ],
    vidaMargen: [
      { vendedor: 'ANGELA', suma_pct: 90, n_lineas: 3 }, // 10 + 20 + 60 -> 30 %
      { vendedor: 'PRAVIN', suma_pct: 60, n_lineas: 1 }, // 60 %
    ],
  };

  it('por defecto (sin flag) no incluye la clave y NO ejecuta la consulta de margen', async () => {
    mockDb(MARGEN_LINEAS);
    const informe = await fetchComisiones('2026-11', HOY, 0.5);
    expect(informe.filas.every((f) => !('margen_pct' in f))).toBe(true);
    expect('margen_pct' in informe.totales).toBe(false);
    expect(JSON.stringify(informe)).not.toContain('margen_pct');
    expect(queryMock.mock.calls.some((c) => String(c[0]).includes('precread'))).toBe(false);
  });

  it('(a) promedio simple por linea: 10 %, 20 % y 60 % -> 30 % (no ponderado)', async () => {
    // Lineas reales con cantidades y costos distintos para que el ponderado difiera.
    const lineas = [
      { precio: 110, costo: 100, cant: 1 }, // +10 %
      { precio: 12, costo: 10, cant: 1 }, // +20 %
      { precio: 1600, costo: 1000, cant: 3 }, // +60 %
    ];
    const pct = (l: { precio: number; costo: number }) => ((l.precio - l.costo) / l.costo) * 100;
    const ponderadoPorCosto =
      (lineas.reduce((s, l) => s + (l.precio - l.costo) * l.cant, 0) /
        lineas.reduce((s, l) => s + l.costo * l.cant, 0)) *
      100;
    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaMargen: [
        {
          vendedor: 'ANGELA',
          suma_pct: lineas.reduce((s, l) => s + pct(l), 0),
          n_lineas: lineas.length,
        },
      ],
    });

    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas[0].margen_pct).toBeCloseTo(30, 10);
    expect(informe.filas[0].margen_pct).not.toBeCloseTo(ponderadoPorCosto, 2); // ≈ 58,3 %
  });

  it('(a2) s19: la linea de costo 0,01 (placeholder) no entra en la suma ni en el conteo', async () => {
    // La consulta SQL ya la excluye (> 0.01); aqui llegan solo las lineas validas 10 % y 20 %.
    const pctPlaceholder = ((18 - 0.01) / 0.01) * 100; // 179.900 %: lo que rompia el promedio
    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', suma_pct: 10 + 20, n_lineas: 2 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas[0].margen_pct).toBeCloseTo(15, 10); // 30 / 2, no (30 + 179900) / 3
    expect(informe.filas[0].margen_pct).not.toBeCloseTo((30 + pctPlaceholder) / 3, 2);
  });

  it('(b) vida (2 lineas, suma 50) + sanjh (1 linea, suma 10) = 60/3 = 20 %, no 17,5 %', async () => {
    mockDb({
      vidaVendedores: ['ANGELA'],
      sanjhVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', suma_pct: 50, n_lineas: 2 }],
      sanjhMargen: [{ vendedor: 'ANGELA', suma_pct: 10, n_lineas: 1 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas).toHaveLength(1);
    expect(informe.filas[0].margen_pct).toBeCloseTo(20, 10);
    expect(informe.filas[0].margen_pct).not.toBeCloseTo(17.5, 10); // promedio de promedios (25 y 10)
    expect(informe.totales.margen_pct).toBeCloseTo(20, 10);
  });

  it('(c) total global = sumaTodos / lineasTodas, no el promedio de las filas', async () => {
    mockDb(MARGEN_LINEAS);
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    const angela = informe.filas.find((f) => f.vendedor === 'ANGELA')!;
    const pravin = informe.filas.find((f) => f.vendedor === 'PRAVIN')!;
    expect(angela.margen_pct).toBeCloseTo(30, 10);
    expect(pravin.margen_pct).toBeCloseTo(60, 10);
    expect(informe.totales.margen_pct).toBeCloseTo(150 / 4, 10); // 37,5 %
    expect(informe.totales.margen_pct).not.toBeCloseTo(45, 10); // promedio de filas (30 y 60)
  });

  it('(d) precread 0 cuenta como -100 %; sin costo o precread NULL no entran (los filtra la consulta)', async () => {
    mockDb({
      vidaVendedores: ['ANGELA', 'PRAVIN'],
      vidaMargen: [
        // 3 lineas fisicas, una con precread NULL: la consulta la excluye y solo quedan 2.
        { vendedor: 'ANGELA', suma_pct: 50, n_lineas: 2 },
        { vendedor: 'PRAVIN', suma_pct: -100, n_lineas: 1 }, // una linea con precread = 0
      ],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas.find((f) => f.vendedor === 'ANGELA')!.margen_pct).toBeCloseTo(25, 10);
    expect(informe.filas.find((f) => f.vendedor === 'PRAVIN')!.margen_pct).toBeCloseTo(-100, 10);
    const sqlMargen = consultaMargenComisiones('vida');
    expect(sqlMargen).toContain('i.cosunita > 0.01');
    expect(sqlMargen).toContain('i.precread IS NOT NULL');
  });

  it('(e) sin lineas validas -> null serializable, nunca Infinity/NaN', async () => {
    mockDb({
      vidaVendedores: ['ANGELA', 'PRAVIN'],
      vidaMargen: [{ vendedor: 'ANGELA', suma_pct: 100, n_lineas: 0 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas.every((f) => f.margen_pct === null)).toBe(true);
    expect(informe.totales.margen_pct).toBeNull();
    expect(() => JSON.stringify(informe)).not.toThrow();
    expect(JSON.stringify(informe)).not.toMatch(/Infinity|NaN/);
  });

  it('"ANGELA" y " angela " de empresas distintas son una fila y suman porcentajes y lineas', async () => {
    mockDb({
      vidaVendedores: ['ANGELA'],
      sanjhVendedores: [' angela '],
      vidaMargen: [{ vendedor: 'ANGELA', suma_pct: 40, n_lineas: 1 }],
      sanjhMargen: [{ vendedor: ' angela ', suma_pct: 30, n_lineas: 1 }],
    });
    const informe = await fetchComisiones('2026-11', HOY, 0.5, true);
    expect(informe.filas).toHaveLength(1);
    expect(informe.filas[0].margen_pct).toBeCloseTo(35, 10); // (40+30)/2
  });

  it('duplicar exactamente una linea no cambia el porcentaje (D14)', async () => {
    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', suma_pct: 120, n_lineas: 4 }],
    });
    const base = await fetchComisiones('2026-11', HOY, 0.5, true);

    mockDb({
      vidaVendedores: ['ANGELA'],
      vidaMargen: [{ vendedor: 'ANGELA', suma_pct: 150, n_lineas: 5 }], // +1 linea de 30 %
    });
    const duplicado = await fetchComisiones('2026-11', HOY, 0.5, true);

    expect(duplicado.filas[0].margen_pct).toBeCloseTo(base.filas[0].margen_pct!, 10);
    expect(duplicado.filas[0].margen_pct).toBeCloseTo(30, 10);
  });

  it('con flag: notas/total/comision no cambian y la consulta de margen NO toca val_rea', async () => {
    mockDb(MARGEN_LINEAS);
    const sin = await fetchComisiones('2026-11', HOY, 0.5);
    mockDb(MARGEN_LINEAS);
    const con = await fetchComisiones('2026-11', HOY, 0.5, true);

    const sinMargen = (f: { margen_pct?: number | null }) => {
      const copia = { ...f };
      delete copia.margen_pct;
      return copia;
    };
    expect(con.filas.map(sinMargen)).toEqual(sin.filas);
    expect(con.totales.notas).toBe(sin.totales.notas);
    expect(con.totales.total_usd).toBe(sin.totales.total_usd);
    expect(con.totales.comision_usd).toBe(sin.totales.comision_usd);
    const margen = queryMock.mock.calls.find((c) => String(c[0]).includes('precread'));
    expect(margen).toBeDefined();
    expect(String(margen![0])).not.toContain('val_rea');
  });

  it('parametriza hoy y el rango del mes en la consulta de margen', async () => {
    mockDb(MARGEN_LINEAS);
    await fetchComisiones('2026-10', HOY, 0.5, true);
    const llamada = queryMock.mock.calls.find(
      (c) => String(c[0]).includes('precread') && String(c[0]).includes('vida.movidcto')
    ) as [string, unknown[]];
    expect(llamada[1]).toEqual([HOY, '2026-10-01', '2026-11-01']);
  });

  it('(g) la consulta NO usa cantsali como ponderador (cantidad no pesa)', () => {
    expect(consultaMargenComisiones('vida')).not.toContain('cantsali');
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
