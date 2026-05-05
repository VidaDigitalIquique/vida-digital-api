import { describe, expect, it } from 'vitest';
import { formatMonto, tipoLabel, estadoBadge } from './deudas-utils';

describe('deudas-utils', () => {
  it('formatMonto formatea con símbolo pesos', () => {
    expect(formatMonto(50000)).toMatch(/^\$/);
    expect(formatMonto(50000)).toContain('50');
  });

  it('tipoLabel devuelve etiqueta legible por tipo', () => {
    expect(tipoLabel('prestamo')).toBe('Préstamo');
    expect(tipoLabel('adelanto')).toBe('Adelanto');
    expect(tipoLabel('quincena')).toBe('Quincena');
    expect(tipoLabel('otro')).toBe('otro');
  });

  it('estadoBadge devuelve clases CSS por estado', () => {
    expect(estadoBadge('pendiente')).toContain('yellow');
    expect(estadoBadge('aceptada')).toContain('blue');
    expect(estadoBadge('rechazada')).toContain('red');
    expect(estadoBadge('confirmada')).toContain('emerald');
    expect(estadoBadge('caduca')).toContain('zinc');
    expect(estadoBadge('desconocido')).toContain('zinc');
  });
});
