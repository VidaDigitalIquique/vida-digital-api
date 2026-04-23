/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProductCard } from '@/components/ProductCard';

jest.mock('@/config/feature-flags.json', () => ({}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { rol: 'admin' } } }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/precios',
}));

const shareImage = jest.fn();

jest.mock('@/hooks/useShareImage', () => ({
  useShareImage: () => ({ shareImage }),
}));

jest.mock('@/components/ClienteStars', () => ({
  ClienteStars: () => null,
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

describe('ProductCard — compradores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);
  });

  test('sin rol bodeguero → muestra botón "Clientes que han comprado"', () => {
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
      screen.getByRole('button', { name: /clientes que han comprado/i })
    ).toBeInTheDocument();
  });

  test('con rol bodeguero → NO muestra el botón', () => {
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
      screen.queryByRole('button', { name: /clientes que han comprado/i })
    ).not.toBeInTheDocument();
  });

  test('click en botón → fetcha el endpoint de compradores', async () => {
    render(
      <ProductCard
        producto={mockProducto as any}
        empresaSlug="vidadigital"
        empresaNombre="IMPORT EXPORT VIDA DIGITAL LTDA."
        onClick={jest.fn()}
        rol="admin"
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /clientes que han comprado/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/productos/ABC123/compradores')
      );
    });
  });

  test('smoke test — renderiza sin errores', () => {
    const { container } = render(
      <ProductCard
        producto={mockProducto as any}
        empresaSlug="vidadigital"
        empresaNombre="IMPORT EXPORT VIDA DIGITAL LTDA."
        onClick={jest.fn()}
        rol="admin"
      />
    );

    expect(container).toBeTruthy();
  });
});
