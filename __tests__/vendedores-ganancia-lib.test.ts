/**
 * S7c-1 — Fase B: riesgos del informe de ganancia por periodo (B1–B9).
 * Estado inicial: ROJO (lib/vendedores-ganancia.ts aun no existe).
 */
const queryMock = jest.fn();

jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

import {
  MAX_PERIODOS,
  consultaGanancia,
  etiquetaPeriodo,
  fetchGanancia,
  parsearAgrupacion,
  rangoPorDefecto,
} from '@/lib/vendedores-ganancia';
import { periodosEnRango } from '@/lib/vendedores-ganancia-tipos';

type Fila = { periodo: string; total_usd: unknown };

function responder(vida: Fila[], sanjh: Fila[]) {
  queryMock.mockImplementation((text: string) =>
    Promise.resolve(text.includes('vida.movidcto') ? vida : sanjh)
  );
}

beforeEach(() => {
  queryMock.mockReset();
  responder([], []);
});

describe('B1 — defaults independientes de la TZ del proceso', () => {
  const hoy = '2026-11-24';
  it('dia = mes en curso; semana/mes = año en curso; anio = ultimos 5 años', () => {
    expect(rangoPorDefecto('dia', hoy)).toEqual({ desde: '2026-11-01', hasta: '2026-11-24' });
    expect(rangoPorDefecto('semana', hoy)).toEqual({ desde: '2026-01-01', hasta: '2026-11-24' });
    expect(rangoPorDefecto('mes', hoy)).toEqual({ desde: '2026-01-01', hasta: '2026-11-24' });
    expect(rangoPorDefecto('anio', hoy)).toEqual({ desde: '2022-01-01', hasta: '2026-11-24' });
  });

  it('parsearAgrupacion rechaza valores fuera del mapa', () => {
    expect(parsearAgrupacion('dia')).toBe('dia');
    expect(parsearAgrupacion('semana')).toBe('semana');
    expect(parsearAgrupacion('mes')).toBe('mes');
    expect(parsearAgrupacion('anio')).toBe('anio');
    expect(parsearAgrupacion('years')).toBeNull();
    expect(parsearAgrupacion('')).toBeNull();
    expect(parsearAgrupacion(null)).toBeNull();
  });
});

describe('B2 — semana que cruza año y se agrupa por lunes', () => {
  it('etiqueta de la semana y date_trunc week', () => {
    expect(etiquetaPeriodo('semana', '2026-12-28')).toBe('Sem. 28-12-2026 (lun)');
    expect(etiquetaPeriodo('dia', '2026-11-24')).toBe('24-11-2026');
    expect(etiquetaPeriodo('mes', '2026-11')).toBe('2026-11');
    expect(etiquetaPeriodo('anio', '2026')).toBe('2026');
    const { text } = consultaGanancia('vida', 'semana', 'todas', '2026-01-01', '2026-11-24', '2026-11-24');
    expect(text).toContain(`date_trunc('week'`);
  });
});

describe('B3 — notas con lineas duplicadas (D14)', () => {
  const { text } = consultaGanancia('vida', 'mes', 'todas', '2026-01-01', '2026-11-24', '2026-11-24');
  it('agrega por nota antes de agrupar y no une public.productos', () => {
    expect(text).toContain('GROUP BY m.knumfoli, m.fechanvt');
    expect(text.indexOf('GROUP BY m.knumfoli')).toBeLessThan(text.lastIndexOf('GROUP BY 1'));
    expect(text).not.toContain('public.productos');
  });
  it('usa la formula del modal (precio - costo) * unidades', () => {
    expect(text).toContain('(COALESCE(i.precread,0) - COALESCE(i.cosunita,0)) * COALESCE(i.cantsali,0)');
  });
});

describe('B4 — costo 0 / valores nulos', () => {
  it('nunca devuelve NaN ni null', async () => {
    responder(
      [{ periodo: '2026-11-02', total_usd: null }, { periodo: '2026-11-01', total_usd: '0' }],
      []
    );
    const informe = await fetchGanancia('dia', '2026-11-01', '2026-11-24', 'todas', '2026-11-24');
    for (const f of informe.filas) {
      for (const n of [f.vida_usd, f.sanjh_usd, f.total_usd]) {
        expect(typeof n).toBe('number');
        expect(Number.isFinite(n)).toBe(true);
      }
    }
    expect(informe.filas.every((f) => f.vida_usd === 0)).toBe(true);
  });
});

describe('B5 — empresa sin ventas en el periodo', () => {
  it('sanjh vacio queda en 0, no null', async () => {
    responder([{ periodo: '2026-11-02', total_usd: 12.5 }], []);
    const informe = await fetchGanancia('dia', '2026-11-01', '2026-11-24', 'todas', '2026-11-24');
    expect(informe.filas).toHaveLength(1);
    expect(informe.filas[0]).toMatchObject({ periodo: '2026-11-02', sanjh_usd: 0, total_usd: 12.5 });
  });
});

describe('B6 — Vida + SANJH = Total fila por fila', () => {
  it('total es el redondeo de la suma de redondeados y los totales suman filas', async () => {
    responder(
      [{ periodo: '2026-11-03', total_usd: 10.004 }, { periodo: '2026-11-02', total_usd: 20 }],
      [{ periodo: '2026-11-03', total_usd: 0.006 }]
    );
    const informe = await fetchGanancia('dia', '2026-11-01', '2026-11-24', 'todas', '2026-11-24');
    for (const f of informe.filas) {
      expect(f.total_usd).toBeCloseTo(Math.round((f.vida_usd + f.sanjh_usd) * 100) / 100, 10);
    }
    expect(informe.totales.vida_usd).toBeCloseTo(
      Math.round(informe.filas.reduce((s, f) => s + f.vida_usd, 0) * 100) / 100,
      10
    );
    expect(informe.totales.total_usd).toBeCloseTo(
      Math.round(informe.filas.reduce((s, f) => s + f.total_usd, 0) * 100) / 100,
      10
    );
  });
});

describe('B7 — orden descendente por periodo', () => {
  it('el periodo mas reciente va primero', async () => {
    responder(
      [{ periodo: '2026-10', total_usd: 1 }, { periodo: '2026-11', total_usd: 2 }],
      []
    );
    const informe = await fetchGanancia('mes', '2026-01-01', '2026-11-24', 'todas', '2026-11-24');
    expect(informe.filas.map((f) => f.periodo)).toEqual(['2026-11', '2026-10']);
  });
});

describe('B8 — SQL no inyectable', () => {
  it('fechas y estado viajan solo en params', () => {
    const { text, params } = consultaGanancia('vida', 'mes', 'facturadas', '2026-09-01', '2026-11-24', '2026-11-24');
    expect(text).not.toContain('2026-09-01');
    // El valor de la API ('facturadas') nunca llega al texto: solo el literal fijo comparado con $4.
    expect(text).not.toContain('facturadas');
    expect(text.split("$4='facturada'").length - 1).toBe(1);
    expect(text).toContain('$2::date');
    expect(text).toContain('$3::date');
    expect(text).toContain('$4::text');
    expect(params).toEqual(['2026-11-24', '2026-09-01', '2026-11-24', 'facturada']);
  });

  it('todas viaja como null', () => {
    const { params } = consultaGanancia('sanjh', 'dia', 'todas', '2026-11-01', '2026-11-24', '2026-11-24');
    expect(params[3]).toBeNull();
  });
});

describe('B-s10a-8 — periodosEnRango (cota previa a consultar)', () => {
  it('cuenta el periodo que contiene cada extremo (inclusive)', () => {
    expect(periodosEnRango('dia', '2026-11-01', '2026-11-24')).toBe(24);
    expect(periodosEnRango('dia', '2024-02-28', '2024-03-01')).toBe(3);
    expect(periodosEnRango('semana', '2026-11-01', '2026-11-24')).toBe(4);
    expect(periodosEnRango('mes', '2026-01-01', '2026-11-24')).toBe(11);
    expect(periodosEnRango('anio', '2026-01-01', '2026-11-24')).toBe(1);
    expect(periodosEnRango('anio', '2020-01-01', '2026-11-24')).toBe(7);
  });

  it('el mismo dia es 1 periodo; un rango gigante supera el tope', () => {
    expect(periodosEnRango('dia', '2026-11-24', '2026-11-24')).toBe(1);
    expect(periodosEnRango('dia', '2020-01-01', '2026-11-24')).toBeGreaterThan(MAX_PERIODOS);
    expect(periodosEnRango('anio', '2020-01-01', '2026-11-24')).toBeLessThanOrEqual(MAX_PERIODOS);
  });
});

describe('B9 — rango gigante', () => {
  it(`mas de ${MAX_PERIODOS} periodos se corta y se marca truncado`, async () => {
    const periodos = Array.from({ length: MAX_PERIODOS + 1 }, (_, i) =>
      new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
    );
    responder(periodos.map((p) => ({ periodo: p, total_usd: 1 })), []);
    const informe = await fetchGanancia('dia', '2020-01-01', '2026-11-24', 'todas', '2026-11-24');
    expect(informe.filas).toHaveLength(MAX_PERIODOS);
    expect(informe.truncado).toBe(true);
    expect(informe.filas[0].periodo).toBe(periodos[periodos.length - 1]);
  });
});

describe('S8 — totales exactos en centavos, sin diferencias entre agrupaciones', () => {
  const cent = (n: number) => Math.round(n * 100);
  const consulta = (agrupacion: 'dia' | 'semana' | 'mes' | 'anio', desde: string, hasta: string) =>
    fetchGanancia(agrupacion, desde, hasta, 'facturadas', '2026-11-24');

  it('la fila de Año es EXACTAMENTE la suma de sus meses', async () => {
    responder(
      [
        { periodo: '2026-01', total_usd: '33.33' },
        { periodo: '2026-02', total_usd: '33.33' },
        { periodo: '2026-03', total_usd: '33.33' },
      ],
      []
    );
    const meses = await consulta('mes', '2026-01-01', '2026-12-31');
    expect(meses.totales.vida_usd).toBe(99.99);

    responder([{ periodo: '2026', total_usd: '99.99' }], []);
    const anio = await consulta('anio', '2026-01-01', '2026-12-31');

    expect(cent(anio.filas[0].total_usd)).toBe(
      meses.filas.reduce((s, f) => s + cent(f.total_usd), 0)
    );
    expect(anio.filas[0].total_usd).toBe(99.99);
  });

  it('0.10 + 0.20 = 30 centavos exactos (sin residuo float)', async () => {
    responder(
      [
        { periodo: '2026-11-01', total_usd: '0.10' },
        { periodo: '2026-11-02', total_usd: '0.20' },
      ],
      []
    );
    const informe = await consulta('dia', '2026-11-01', '2026-11-02');
    expect(informe.totales.vida_usd).toBe(0.3);
    expect(informe.totales.total_usd).toBe(0.3);
    expect(cent(informe.totales.total_usd)).toBe(30);
  });

  it('vida + sanjh = total fila a fila y los totales suman las filas exacto', async () => {
    responder(
      [
        { periodo: '2026-11-01', total_usd: '0.10' },
        { periodo: '2026-11-02', total_usd: '1234.56' },
      ],
      [
        { periodo: '2026-11-01', total_usd: '0.20' },
        { periodo: '2026-11-02', total_usd: '0.01' },
      ]
    );
    const informe = await consulta('dia', '2026-11-01', '2026-11-02');
    for (const f of informe.filas) {
      expect(cent(f.total_usd)).toBe(cent(f.vida_usd) + cent(f.sanjh_usd));
    }
    const suma = (campo: 'vida_usd' | 'sanjh_usd' | 'total_usd') =>
      informe.filas.reduce((s, f) => s + cent(f[campo]), 0);
    expect(cent(informe.totales.vida_usd)).toBe(suma('vida_usd'));
    expect(cent(informe.totales.sanjh_usd)).toBe(suma('sanjh_usd'));
    expect(cent(informe.totales.total_usd)).toBe(suma('total_usd'));
  });

  it('numeric como string, null y vacio -> 0, nunca NaN', async () => {
    responder(
      [
        { periodo: '2026-11-01', total_usd: '1234.56' },
        { periodo: '2026-11-02', total_usd: null },
        { periodo: '2026-11-03', total_usd: '' },
      ],
      []
    );
    const informe = await consulta('dia', '2026-11-01', '2026-11-03');
    expect(informe.filas.find((f) => f.periodo === '2026-11-01')!.vida_usd).toBe(1234.56);
    expect(informe.totales.vida_usd).toBe(1234.56);
    for (const f of informe.filas) expect(Number.isFinite(f.vida_usd)).toBe(true);
  });

  it('el SQL redondea por nota con numeric(2) y no usa float8 para ganancia', () => {
    const { text } = consultaGanancia('vida', 'mes', 'facturadas', '2026-01-01', '2026-12-31', '2026-11-24');
    expect(text).toContain(
      'ROUND(SUM((COALESCE(i.precread,0) - COALESCE(i.cosunita,0)) * COALESCE(i.cantsali,0))::numeric, 2)'
    );
    expect(text).toContain('SUM(g.ganancia)');
    expect(text).not.toContain('::float8');
  });
});
