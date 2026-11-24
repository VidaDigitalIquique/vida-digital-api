import { describe, expect, it } from 'vitest';
import { buildWhatsAppText, formatFecha } from './pettycash-utils';

describe('formatFecha', () => {
  it('formatea fecha ISO a DD de MMMM de YYYY en español', () => {
    expect(formatFecha('2026-05-03')).toBe('3 de mayo de 2026');
    expect(formatFecha('2026-01-15')).toBe('15 de enero de 2026');
    expect(formatFecha('2026-12-31')).toBe('31 de diciembre de 2026');
    expect(formatFecha('2026-05-03T00:00:00.000Z')).toBe('3 de mayo de 2026');
  });
});

const movs = [
  { id: 1, fecha: '2026-05-03', tipo: 'ingreso', concepto: 'Venta', monto: 50000, creado_por: '' },
  { id: 2, fecha: '2026-05-04', tipo: 'egreso',  concepto: 'Limpieza', monto: 5000, creado_por: '' },
];

describe('buildWhatsAppText', () => {
  it('incluye encabezado, período y saldo', () => {
    const text = buildWhatsAppText([], 100000, '2026-05-01', '2026-05-31');
    expect(text).toContain('PETTYCASH');
    expect(text).toContain('2026-05-01');
    expect(text).toContain('2026-05-31');
    expect(text).toContain('100');
  });

  it('lista movimientos con tipo legible', () => {
    const text = buildWhatsAppText(movs as any, 45000, '2026-05-01', '2026-05-31');
    expect(text).toContain('Ingreso');
    expect(text).toContain('Gasto');
    expect(text).toContain('Venta');
    expect(text).toContain('Limpieza');
  });
});
