/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  });

  const baseData = {
    titulo: 'Catalogo Demo',
    descripcion: 'Prueba',
    empresa_slug: 'demo',
    mostrar_precio: true,
  };

  test('Boton de imprimir existe en el DOM', () => {
    const data = {
      ...baseData,
      productos: [
        { id: 1, codigo: 'A1', detalle: 'Producto A', imagen_url: null, es_nuevo: false, cantcaja: 1, umed: 'UND', precio_catalogo: 100 },
      ],
    };

    render(<PublicCatalogoClient data={data} />);

    expect(screen.getByRole('button', { name: /imprimir|pdf/i })).toBeInTheDocument();
  });

  test('Boton llama a window.print()', () => {
    const data = {
      ...baseData,
      productos: [
        { id: 1, codigo: 'A1', detalle: 'Producto A', imagen_url: null, es_nuevo: false, cantcaja: 1, umed: 'UND', precio_catalogo: 100 },
      ],
    };

    render(<PublicCatalogoClient data={data} />);

    const button = screen.getByRole('button', { name: /imprimir|pdf/i });
    fireEvent.click(button);

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
