import { describe, expect, it } from 'vitest';
import { DeudaCreateSchema, DeudaPatchSchema } from './deudas.spec';

describe('DeudaCreateSchema', () => {
  it('requiere usuario_id', () => {
    const r = DeudaCreateSchema.safeParse({ tipo: 'prestamo', monto: 100000 });
    expect(r.success).toBe(false);
  });

  it('acepta registro completo con usuario_id', () => {
    const r = DeudaCreateSchema.safeParse({ usuario_id: 3, tipo: 'adelanto', monto: 50000 });
    expect(r.success).toBe(true);
  });

  it('acepta mes y anio opcionales', () => {
    const r = DeudaCreateSchema.safeParse({ usuario_id: 3, tipo: 'quincena', monto: 20000, mes: 5, anio: 2026 });
    expect(r.success).toBe(true);
  });
});

describe('DeudaPatchSchema', () => {
  it('acepta accion pagar con monto', () => {
    const r = DeudaPatchSchema.safeParse({ accion: 'pagar', monto: 30000 });
    expect(r.success).toBe(true);
  });

  it('rechaza pagar sin monto', () => {
    const r = DeudaPatchSchema.safeParse({ accion: 'pagar' });
    expect(r.success).toBe(false);
  });
});
