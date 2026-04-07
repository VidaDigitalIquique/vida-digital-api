/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProductCard } from '@/components/ProductCard';

jest.mock('@/components/ImageWithFallback', () => ({
  ImageWithFallback: () => <div data-testid="image" />,
}));

describe('ProductCard empresa badge (Slice 2)', () => {
  test('ProductCard renderiza badge con nombre de empresa', () => {
    const producto = {
      codigo: 'ABC',
      detalle: 'Producto',
      imagen_url: null,
      es_nuevo: false,
      prcventa: 100,
      saldo: 10,
      umed: 'UN',
      cantcaja: 1,
    } as any;

    const ProductCardAny = ProductCard as any;

    render(
      <ProductCardAny
        producto={producto}
        empresaSlug="sanjh"
        empresaNombre="IMPORT EXPORT SANJH LTDA."
        onClick={() => {}}
      />
    );

    expect(
      screen.getByText(/SANJH|IMPORT EXPORT SANJH LTDA\./i)
    ).toBeInTheDocument();
  });
});
