/**
 * @jest-environment node
 */

import { filtrarCatalogos } from '../app/(app)/catalogos/catalogos-utils';

const CATALOGOS = [
  { titulo: 'Pelotas y accesorios', descripcion: 'Todo para deporte', categoria: 'Juguetes' },
  { titulo: 'Máquina para pelo', descripcion: 'Corte profesional', categoria: 'Belleza' },
  { titulo: 'Set cocina', descripcion: 'Ideal para chef', categoria: 'Hogar' },
  { titulo: 'Organizador', descripcion: null, categoria: null },
];

describe('filtrarCatalogos', () => {
  test('retorna todos los catálogos si la búsqueda está vacía', () => {
    const result = filtrarCatalogos(CATALOGOS, '');
    expect(result).toEqual(CATALOGOS);
  });

  test('encuentra catálogo cuando la palabra exacta está en el título', () => {
    const result = filtrarCatalogos(CATALOGOS, 'máquina');
    expect(result.map(c => c.titulo)).toContain('Máquina para pelo');
  });

  test('encuentra catálogo cuando la palabra exacta está en la descripción', () => {
    const result = filtrarCatalogos(CATALOGOS, 'chef');
    expect(result.map(c => c.titulo)).toContain('Set cocina');
  });

  test('encuentra catálogo cuando la palabra exacta está en la categoría', () => {
    const result = filtrarCatalogos(CATALOGOS, 'belleza');
    expect(result.map(c => c.titulo)).toContain('Máquina para pelo');
  });

  test('NO retorna catálogo cuando la búsqueda es substring de una palabra ("pelo" no matchea "pelotas")', () => {
    const result = filtrarCatalogos(CATALOGOS, 'pelo');
    expect(result.map(c => c.titulo)).not.toContain('Pelotas y accesorios');
  });

  test('búsqueda case-insensitive ("PELO" encuentra "pelo")', () => {
    const result = filtrarCatalogos(CATALOGOS, 'PELO');
    expect(result.map(c => c.titulo)).toContain('Máquina para pelo');
  });

  test('búsqueda con múltiples palabras retorna catálogos que contengan AL MENOS UNA de las palabras', () => {
    const result = filtrarCatalogos(CATALOGOS, 'chef belleza');
    const titulos = result.map(c => c.titulo);
    expect(titulos).toContain('Set cocina');
    expect(titulos).toContain('Máquina para pelo');
  });
});
