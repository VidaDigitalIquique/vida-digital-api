/**
 * Tests PBT-IA — Slice 2: parseKeywords retrocompatible
 * Estado inicial: ROJO (función aún no existe)
 */
import { parseKeywords } from './route';

jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: { json: jest.fn() },
}));
jest.mock('./filter-products', () => ({ filterProducts: jest.fn() }));
jest.mock('@/utils/catalogo-ingreso', () => ({ getLatestIngresoRealCodigos: jest.fn() }));

describe('parseKeywords — retrocompatibilidad', () => {
  it('string vacío retorna []', () => {
    expect(parseKeywords('')).toEqual([]);
  });

  it('string solo espacios retorna []', () => {
    expect(parseKeywords('   ')).toEqual([]);
  });

  it('string con coma → split por coma', () => {
    expect(parseKeywords('vidrio,tv')).toEqual(['vidrio', 'tv']);
  });

  it('string con coma y espacios → split por coma + trim', () => {
    expect(parseKeywords('vidrio, tv')).toEqual(['vidrio', 'tv']);
  });

  it('string sin coma → split por espacio', () => {
    expect(parseKeywords('vidrio tv')).toEqual(['vidrio', 'tv']);
  });

  it('string sin coma con espacios extra → trim cada token', () => {
    expect(parseKeywords('  vidrio  tv  ')).toEqual(['vidrio', 'tv']);
  });

  it('una sola palabra sin coma → array de un elemento', () => {
    expect(parseKeywords('vidrio')).toEqual(['vidrio']);
  });
});
