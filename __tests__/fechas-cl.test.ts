import path from 'path';
import { execFileSync } from 'child_process';
import {
  fechaDiaCL,
  fechaHoraCL,
  fechaHoraLargaCL,
  horaCL,
  hoyCL,
  primerDiaMesCL,
  ultimoDiaMesCL,
} from '@/lib/fechas';

// 2026-11-11T13:30:00Z = 10:30 en Chile (UTC-3, horario de verano).
const INSTANTE = new Date('2026-11-11T13:30:00Z');
const SEPTIEMBRE = new Date('2026-09-15T13:00:00Z');

const TSX = path.resolve(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const FECHAS = path.resolve(__dirname, '..', 'lib', 'fechas.ts');

/** Texto con espacios duros (U+00A0) o estrechos (U+202F): Node y Chrome no coinciden. */
const ESPACIO_DURO = /[  ]/;

function enProcesoConTZ(tz: string) {
  const script = `
    const f = require(${JSON.stringify(FECHAS)});
    const { format } = require('date-fns');
    const { es } = require('date-fns/locale');
    const inst = new Date('2026-11-11T13:30:00Z');
    const sep = new Date('2026-09-15T13:00:00Z');
    const tardeNoche = new Date('2026-11-12T01:30:00Z'); // 22:30 del 11 en Chile
    process.stdout.write(JSON.stringify({
      fechaHora: f.fechaHoraCL(inst),
      larga: f.fechaHoraLargaCL(inst),
      largaPm: f.fechaHoraLargaCL(new Date('2026-11-11T23:05:07Z')),
      hora: f.horaCL(inst),
      fechaDia: f.fechaDiaCL('2026-11-09'),
      hoy: f.hoyCL(tardeNoche),
      primerDia: f.primerDiaMesCL(tardeNoche),
      ultimoDiaNov: f.ultimoDiaMesCL(new Date('2026-11-30T20:00:00Z')),
      paridadNov: f.fechaHoraCL(inst) === format(inst, 'dd MMM yyyy, HH:mm', { locale: es }),
      paridadSep: f.fechaHoraCL(sep) === format(sep, 'dd MMM yyyy, HH:mm', { locale: es }),
    }));
  `;
  const salida = execFileSync(process.execPath, [TSX, '-e', script], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(salida);
}

describe('lib/fechas — texto fijo en America/Santiago', () => {
  it('fechaHoraCL: dia 2 digitos, mes corto sin punto, HH:mm 24 h', () => {
    expect(fechaHoraCL(INSTANTE)).toBe('11 nov 2026, 10:30');
    expect(fechaHoraCL(INSTANTE.toISOString())).toBe('11 nov 2026, 10:30');
    expect(fechaHoraCL(SEPTIEMBRE)).toBe('15 sep 2026, 10:00');
    expect(fechaHoraCL(new Date('2026-01-01T03:00:00Z'))).toBe('01 ene 2026, 00:00');
  });

  it('fechaHoraLargaCL: texto fijo, con espacio normal (no el del ICU)', () => {
    expect(fechaHoraLargaCL(INSTANTE)).toBe('11-11-2026, 10:30:00 a. m.');
    expect(fechaHoraLargaCL(INSTANTE.toISOString())).toBe('11-11-2026, 10:30:00 a. m.');
    // PM, cero horas y mediodia como en es-CL (h12 sin relleno); escritos a mano, sin ICU.
    expect(fechaHoraLargaCL(new Date('2026-11-11T23:05:07Z'))).toBe('11-11-2026, 8:05:07 p. m.');
    expect(fechaHoraLargaCL(new Date('2026-01-01T03:00:00Z'))).toBe('01-01-2026, 12:00:00 a. m.');
    expect(fechaHoraLargaCL(new Date('2026-11-11T15:00:00Z'))).toBe('11-11-2026, 12:00:00 p. m.');
    // Igual a toLocaleString salvo el tipo de espacio.
    const oracle = (d: Date) =>
      d.toLocaleString('es-CL', { timeZone: 'America/Santiago' }).replace(/[  ]/g, ' ');
    expect(fechaHoraLargaCL(INSTANTE)).toBe(oracle(INSTANTE));
    expect(fechaHoraLargaCL(new Date('2026-11-11T23:05:07Z'))).toBe(oracle(new Date('2026-11-11T23:05:07Z')));
  });

  it('ninguna salida contiene espacio duro ni estrecho (AM y PM)', () => {
    for (const d of [INSTANTE, new Date('2026-11-11T23:05:07Z')]) {
      const salidas = [
        fechaHoraCL(d),
        fechaHoraLargaCL(d),
        horaCL(d),
        hoyCL(d),
        primerDiaMesCL(d),
        ultimoDiaMesCL(d),
      ];
      for (const s of salidas) expect(s).not.toMatch(ESPACIO_DURO);
    }
  });

  it('fechaDiaCL: reordena YYYY-MM-DD a DD-MM-YYYY sin Date', () => {
    expect(fechaDiaCL('2026-11-09')).toBe('09-11-2026');
    expect(fechaDiaCL('1999-01-31')).toBe('31-01-1999');
  });

  it('fechaDiaCL: una entrada que no es YYYY-MM-DD se devuelve tal cual', () => {
    expect(fechaDiaCL('')).toBe('');
    expect(fechaDiaCL('2026-11-09T00:00:00Z')).toBe('2026-11-09T00:00:00Z');
    expect(fechaDiaCL('09/11/2026')).toBe('09/11/2026');
  });

  it('horaCL: HH:mm', () => {
    expect(horaCL(INSTANTE)).toBe('10:30');
    expect(horaCL('2026-01-01T03:05:00Z')).toBe('00:05');
  });

  it('hoyCL: a las 22:30 de Chile devuelve el dia de Chile, no el UTC', () => {
    expect(hoyCL(new Date('2026-11-12T01:30:00Z'))).toBe('2026-11-11');
  });

  it('primerDiaMesCL y ultimoDiaMesCL en Chile', () => {
    expect(primerDiaMesCL(new Date('2026-11-12T01:30:00Z'))).toBe('2026-11-01');
    expect(ultimoDiaMesCL(new Date('2026-11-30T20:00:00Z'))).toBe('2026-11-30');
    expect(ultimoDiaMesCL(new Date('2026-02-10T12:00:00Z'))).toBe('2026-02-28');
  });

  it('mismo texto con el proceso en UTC, Asia/Tokyo o America/Santiago', () => {
    const esperado = {
      fechaHora: '11 nov 2026, 10:30',
      larga: '11-11-2026, 10:30:00 a. m.',
      largaPm: '11-11-2026, 8:05:07 p. m.',
      hora: '10:30',
      fechaDia: '09-11-2026',
      hoy: '2026-11-11',
      primerDia: '2026-11-01',
      ultimoDiaNov: '2026-11-30',
    };
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/Santiago']) {
      const { paridadNov, paridadSep, ...textos } = enProcesoConTZ(tz);
      expect({ tz, ...textos }).toEqual({ tz, ...esperado });
      // Paridad con date-fns solo tiene sentido si el proceso corre en Chile.
      if (tz === 'America/Santiago') expect({ paridadNov, paridadSep }).toEqual({ paridadNov: true, paridadSep: true });
    }
  });
});
