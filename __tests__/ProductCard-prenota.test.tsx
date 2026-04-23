/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProductCard } from '@/components/ProductCard';

jest.mock('@/components/AgregarAPrenotaModal', () => ({
  AgregarAPrenotaModal: () => null,
}));

const mockProducto = {
  id: 1,
  empresa_id: 2,
  codigo: 'ABC123',
  nroingreso: null,
  saldo: 10,
  umed: 'UN',
  cif: 100,
  costo: 80,
  prcventa: 150,
  prcminimo: 120,
  cantcaja: 6,
  pesocaja: 1,
  cubicaja: 1,
  detalle: 'Producto Test',
  imagen_url: null,
  es_nuevo: false,
  categoria: null,
  fecha_ingreso: new Date(),
  updated_at: new Date(),
};

describe('ProductCard — pre-nota', () => {
  test('muestra botón "Agregar a Pre-Nota" si rol !== bodeguero', () => {
    render(
      <ProductCard
        producto={mockProducto as any}
        empresaSlug="vidadigital"
        empresaNombre="IMPORT EXPORT VIDA DIGITAL LTDA."
        onClick={jest.fn()}
        rol="admin"
      />
    );

    expect(
      screen.getByRole('button', { name: /agregar a pre-nota/i })
    ).toBeInTheDocument();
  });

  test('no muestra botón si rol === bodeguero', () => {
    render(
      <ProductCard
        producto={mockProducto as any}
        empresaSlug="vidadigital"
        empresaNombre="IMPORT EXPORT VIDA DIGITAL LTDA."
        onClick={jest.fn()}
        rol="bodeguero"
      />
    );

    expect(
      screen.queryByRole('button', { name: /agregar a pre-nota/i })
    ).not.toBeInTheDocument();
  });
});
