import path from 'path';
import { execFileSync } from 'child_process';
import { daysInRange } from '@/app/(app)/pettycash/pettycash-utils';

const TSX = path.resolve(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const UTILS = path.resolve(__dirname, '..', 'app', '(app)', 'pettycash', 'pettycash-utils.ts');

function enProcesoConTZ(tz: string) {
  const script = `
    const { daysInRange } = require(${JSON.stringify(UTILS)});
    process.stdout.write(JSON.stringify({
      tres: daysInRange('2026-11-28', '2026-11-30'),
      cruzaMes: daysInRange('2026-11-30', '2026-12-02'),
      unDia: daysInRange('2026-11-30', '2026-11-30'),
      vacio: daysInRange('2026-12-01', '2026-11-30'),
    }));
  `;
  const salida = execFileSync(process.execPath, [TSX, '-e', script], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(salida);
}

describe('pettycash daysInRange — dias de Chile sin depender de la zona del proceso', () => {
  // El orden se mantiene como hoy: descendente (el mas reciente primero).
  const esperado = {
    tres: ['2026-11-30', '2026-11-29', '2026-11-28'],
    cruzaMes: ['2026-12-02', '2026-12-01', '2026-11-30'],
    unDia: ['2026-11-30'],
    vacio: [],
  };

  it('devuelve los dias del rango', () => {
    expect(enProcesoConTZ('America/Santiago')).toEqual(esperado);
  });

  it('mismo resultado con el proceso en UTC, Asia/Tokyo o America/Santiago', () => {
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/Santiago']) {
      expect({ tz, ...enProcesoConTZ(tz) }).toEqual({ tz, ...esperado });
    }
  });

  it('no usa la zona del proceso (llamada directa)', () => {
    expect(daysInRange('2026-11-28', '2026-11-30')).toEqual(esperado.tres);
    expect(daysInRange('2026-02-27', '2026-03-01')).toEqual(['2026-03-01', '2026-02-28', '2026-02-27']);
  });
});
