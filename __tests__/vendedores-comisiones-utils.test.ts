/**
 * S5a — Fase B: funciones puras de comisiones (R8).
 * Estado inicial: ROJO (lib/comisiones-utils.ts aun no existe).
 */
import {
  etiquetaMes,
  mesDeHoy,
  mesValido,
  redondearCentavos,
  rangoMes,
  validarPct,
} from '@/lib/comisiones-utils';

describe('mesValido', () => {
  it.each(['2026-01', '2026-10', '2026-12', '2000-01', '2100-12'])('acepta %p', (mes) => {
    expect(mesValido(mes)).toBe(mes);
  });

  it.each(['2026-13', '2026-00', '26-11', '2026-1', '', null, '2026-11-01', '1999-12', '2101-01'])(
    'rechaza %p',
    (mes) => {
      expect(mesValido(mes)).toBeNull();
    }
  );
});

describe('mesDeHoy', () => {
  it('toma el mes de la fecha de Chile ya calculada (sin Date ni TZ del proceso)', () => {
    expect(mesDeHoy('2026-11-11')).toBe('2026-11');
    // 2026-12-01 02:00 UTC en Chile todavia es 30-11: hoyCL ya lo resolvio.
    expect(mesDeHoy('2026-11-30')).toBe('2026-11');
  });
});

describe('rangoMes', () => {
  it('primer dia del mes y primer dia del mes siguiente (exclusivo)', () => {
    expect(rangoMes('2026-11')).toEqual({ desde: '2026-11-01', hasta: '2026-12-01' });
    expect(rangoMes('2026-01')).toEqual({ desde: '2026-01-01', hasta: '2026-02-01' });
  });

  it('diciembre cruza de anio', () => {
    expect(rangoMes('2026-12')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' });
  });
});

describe('etiquetaMes', () => {
  it('nombre completo en espanol, sin depender del ICU (septiembre no es "sept")', () => {
    expect(etiquetaMes('2026-11')).toBe('noviembre 2026');
    expect(etiquetaMes('2026-09')).toBe('septiembre 2026');
  });

  it('los 12 meses tienen nombre', () => {
    const esperados = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    esperados.forEach((nombre, i) => {
      expect(etiquetaMes(`2026-${String(i + 1).padStart(2, '0')}`)).toBe(`${nombre} 2026`);
    });
  });
});

describe('validarPct', () => {
  it.each([0, 0.5, 1, 33.33, 100])('acepta %p', (pct) => {
    expect(validarPct(pct)).toBe(pct);
  });

  it('normaliza el ruido binario a 2 decimales', () => {
    expect(validarPct(0.1 + 0.2)).toBe(0.3);
  });

  it.each([-1, 100.01, 101, 0.555, '0.5', null, undefined, NaN, Infinity, true, {}])(
    'rechaza %p',
    (pct) => {
      expect(validarPct(pct)).toBeNull();
    }
  );
});

describe('redondearCentavos', () => {
  it('half-up a centavos, sin ruido binario', () => {
    expect(redondearCentavos(1.005)).toBe(1.01);
    expect(redondearCentavos(2.675)).toBe(2.68);
    expect(redondearCentavos(61.72839)).toBe(61.73);
    expect(redondearCentavos(0)).toBe(0);
    expect(redondearCentavos(0.004)).toBe(0);
  });
});
