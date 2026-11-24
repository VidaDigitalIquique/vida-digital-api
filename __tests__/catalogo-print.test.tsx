/** @jest-environment jsdom */
import React from 'react';
import { render, act } from '@testing-library/react';
import { PublicCatalogoClient } from '@/app/catalogo/[slug]/client_page';

jest.mock('@/components/ImageWithFallback', () => ({
  ImageWithFallback: () => <div data-testid="image-fallback" />,
}));

jest.mock('@/lib/utils', () => ({
  formatUSD: (value: number) => String(value),
}));

describe('PublicCatalogoClient print support', () => {
  beforeEach(() => {
    window.print = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    window.history.pushState({}, '', '/');
  });

  const baseData = {
    titulo: 'Catalogo Demo',
    descripcion: 'Prueba',
    empresa_slug: 'demo',
    mostrar_precio: true,
  };

  // El catálogo ya no tiene botón imprimir: auto-imprime 800 ms después si ?print=1.
  test('sin ?print=1 no llama a window.print()', () => {
    const data = {
      ...baseData,
      productos: [
        { id: 1, codigo: 'A1', detalle: 'Producto A', imagen_url: null, es_nuevo: false, cantcaja: 1, umed: 'UND', precio_catalogo: 100 },
      ],
    };

    render(<PublicCatalogoClient data={data} />);
    act(() => { jest.advanceTimersByTime(1000); });

    expect(window.print).not.toHaveBeenCalled();
  });

  test('con ?print=1 llama a window.print() tras 800 ms', () => {
    window.history.pushState({}, '', '/catalogo/demo?print=1');
    const data = {
      ...baseData,
      productos: [
        { id: 1, codigo: 'A1', detalle: 'Producto A', imagen_url: null, es_nuevo: false, cantcaja: 1, umed: 'UND', precio_catalogo: 100 },
      ],
    };

    render(<PublicCatalogoClient data={data} />);
    act(() => { jest.advanceTimersByTime(800); });

    expect(window.print).toHaveBeenCalled();
  });

  test('Cada tarjeta de producto tiene clase print-page', () => {
    const data = {
      ...baseData,
      productos: [
        { id: 1, codigo: 'A1', detalle: 'Producto A', imagen_url: null, es_nuevo: false, cantcaja: 1, umed: 'UND', precio_catalogo: 100 },
        { id: 2, codigo: 'B2', detalle: 'Producto B', imagen_url: null, es_nuevo: false, cantcaja: 1, umed: 'UND', precio_catalogo: 200 },
        { id: 3, codigo: 'C3', detalle: 'Producto C', imagen_url: null, es_nuevo: false, cantcaja: 1, umed: 'UND', precio_catalogo: 300 },
      ],
    };

    const { container } = render(<PublicCatalogoClient data={data} />);

    expect(container.querySelectorAll('.print-page')).toHaveLength(3);
  });
});
