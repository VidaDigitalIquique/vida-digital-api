/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgregarAPrenotaModal } from '@/components/AgregarAPrenotaModal';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { rol: 'vendedor' } } }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/precios',
}));

const producto = {
  codigo: 'ABC123',
  detalle: 'Producto Test',
  imagen_url: null,
  empresa_id: 2,
  prcventa: 150,
  cantcaja: 6,
  saldo: 10,
};

describe('AgregarAPrenotaModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('smoke test — renderiza sin errores cuando open=true', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    const { container } = render(
      <AgregarAPrenotaModal
        open={true}
        onClose={jest.fn()}
        producto={producto}
      />
    );

    expect(container).toBeTruthy();
  });

  test('muestra lista de pre-notas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 1, titulo: 'Pre-nota #1' }] }),
    } as any);

    render(
      <AgregarAPrenotaModal
        open={true}
        onClose={jest.fn()}
        producto={producto}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pre-nota #1')).toBeInTheDocument();
    });
  });

  test('muestra campo de cajas y precio', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 1, titulo: 'Pre-nota #1' }] }),
    } as any);

    render(
      <AgregarAPrenotaModal
        open={true}
        onClose={jest.fn()}
        producto={producto}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2);
    });
  });

  test('click en Agregar llama al endpoint', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/prenotas' && (!options || options.method !== 'POST')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: 1, titulo: 'Pre-nota #1' }] }),
        });
      }

      if (url.includes('/items')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 55 }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    render(
      <AgregarAPrenotaModal
        open={true}
        onClose={jest.fn()}
        producto={producto}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pre-nota #1')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '1' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/prenotas/1/items',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('no renderiza nada cuando open=false', () => {
    global.fetch = jest.fn();

    const { container } = render(
      <AgregarAPrenotaModal
        open={false}
        onClose={jest.fn()}
        producto={producto}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
