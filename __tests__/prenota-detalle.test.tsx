/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrenotaDetallePage } from '@/app/(app)/prenotas/[id]/client_page';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { rol: 'vendedor' } } }),
}));

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: '1' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/prenotas/1',
}));

describe('PrenotaDetallePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('smoke test — renderiza sin errores', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        titulo: 'Pre-nota #1 — 23 Apr 2026',
        nombre_cliente: null,
        kcodclie: null,
        items: [],
      }),
    } as any);

    const { container } = render(<PrenotaDetallePage session={{ user: { rol: 'vendedor' } }} params={{ id: '1' }} />);

    expect(container).toBeTruthy();
  });

  test('muestra items de la prenota', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        titulo: 'Pre-nota #1 — 23 Apr 2026',
        nombre_cliente: null,
        kcodclie: null,
        items: [
          {
            id: 1,
            codigo: 'ABC123',
            descripcion: 'Producto Test',
            empresa_id: 2,
            cajas: 1,
            unidades: 6,
            precio: 150,
            saldo_zofri: 10,
          },
        ],
      }),
    } as any);

    render(<PrenotaDetallePage session={{ user: { rol: 'vendedor' } }} params={{ id: '1' }} />);

    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });
  });

  test('advertencia de stock', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        titulo: 'Pre-nota #1 — 23 Apr 2026',
        nombre_cliente: null,
        kcodclie: null,
        items: [
          {
            id: 1,
            codigo: 'ABC123',
            descripcion: 'Producto Test',
            empresa_id: 2,
            cajas: 2,
            unidades: 20,
            precio: 150,
            saldo_zofri: 10,
          },
        ],
      }),
    } as any);

    render(<PrenotaDetallePage session={{ user: { rol: 'vendedor' } }} params={{ id: '1' }} />);

    await waitFor(() => {
      expect(screen.getByText(/supera stock disponible/i)).toBeInTheDocument();
    });
  });

  test('sin items muestra mensaje vacío', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        titulo: 'Pre-nota #1 — 23 Apr 2026',
        nombre_cliente: null,
        kcodclie: null,
        items: [],
      }),
    } as any);

    render(<PrenotaDetallePage session={{ user: { rol: 'vendedor' } }} params={{ id: '1' }} />);

    await waitFor(() => {
      expect(screen.getByText(/no hay productos/i)).toBeInTheDocument();
    });
  });

  test('asignar cliente llama al PATCH', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/prenotas/1') && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 1,
            titulo: 'Pre-nota #1 — 23 Apr 2026',
            nombre_cliente: 'JUAN PEREZ',
            kcodclie: 100,
            items: [],
          }),
        });
      }

      if (url.includes('/api/ventas/clientes')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                kcodclie: '100',
                nombress: 'JUAN PEREZ',
                ciudad: 'Arica',
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 1,
          titulo: 'Pre-nota #1 — 23 Apr 2026',
          nombre_cliente: null,
          kcodclie: null,
          items: [],
        }),
      });
    });

    render(<PrenotaDetallePage session={{ user: { rol: 'vendedor' } }} params={{ id: '1' }} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), {
      target: { value: 'juan' },
    });

    await waitFor(() => {
      expect(screen.getByText('JUAN PEREZ')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('JUAN PEREZ'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/prenotas/1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kcodclie: 100, nombre_cliente: 'JUAN PEREZ' }),
        })
      );
    });
  });
});
