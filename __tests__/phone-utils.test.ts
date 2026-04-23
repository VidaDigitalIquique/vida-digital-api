/**
 * @jest-environment node
 */

import { inferPaisDesdePhone, normalizePhone } from '@/lib/phone-utils';

describe('lib/phone-utils', () => {
  describe('normalizePhone', () => {
    test('normaliza teléfono chileno con espacios y prefijo +56', () => {
      expect(normalizePhone('+56 9 1234 5678')).toBe('12345678');
    });

    test('normaliza teléfono boliviano y devuelve últimos 8 dígitos', () => {
      expect(normalizePhone('59174512563')).toBe('74512563');
    });

    test('normaliza teléfono argentino con símbolos y devuelve últimos 8 dígitos', () => {
      expect(normalizePhone('+54 9 3812 72-2727')).toBe('12722727');
    });

    test('normaliza teléfono chileno sin símbolos', () => {
      expect(normalizePhone('56995822304')).toBe('95822304');
    });

    test('string vacío retorna vacío', () => {
      expect(normalizePhone('')).toBe('');
    });

    test('menos de 8 dígitos retorna todos los dígitos disponibles', () => {
      expect(normalizePhone('12-34')).toBe('1234');
    });
  });

  describe('inferPaisDesdePhone', () => {
    test('detecta Chile desde 56912345678', () => {
      expect(inferPaisDesdePhone('56912345678')).toBe('Chile');
    });

    test('detecta Chile desde +56 9 1234 5678', () => {
      expect(inferPaisDesdePhone('+56 9 1234 5678')).toBe('Chile');
    });

    test('detecta Bolivia', () => {
      expect(inferPaisDesdePhone('59174512563')).toBe('Bolivia');
    });

    test('detecta Perú', () => {
      expect(inferPaisDesdePhone('51975951920')).toBe('Perú');
    });

    test('detecta Paraguay', () => {
      expect(inferPaisDesdePhone('595983162636')).toBe('Paraguay');
    });

    test('detecta Argentina', () => {
      expect(inferPaisDesdePhone('5491155725364')).toBe('Argentina');
    });

    test('detecta Brasil', () => {
      expect(inferPaisDesdePhone('5565994-58853')).toBe('Brasil');
    });

    test('detecta Uruguay', () => {
      expect(inferPaisDesdePhone('59894272868')).toBe('Uruguay');
    });

    test('código no reconocido retorna null', () => {
      expect(inferPaisDesdePhone('123456789')).toBeNull();
    });

    test('string vacío retorna null', () => {
      expect(inferPaisDesdePhone('')).toBeNull();
    });
  });
});
