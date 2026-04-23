/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrenotasPage } from '@/app/(app)/prenotas/client_page';

jest.mock('@/config/feature-flags.json', () => ({}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { rol: 'vendedor' } } }),
}));

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/prenotas',
}));

describe('PrenotasPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('smoke test — renderiza sin errores con lista vacía', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    const { container } = render(<PrenotasPage session={{ user: { rol: 'vendedor' } }} />);

    expect(container).toBeTruthy();
  });

  test('muestra lista de pre-notas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            titulo: 'Pre-nota #1 — 23 Apr 2026',
            created_at: '2026-04-23',
            nombre_cliente: null,
          },
        ],
      }),
    } as any);

    render(<PrenotasPage session={{ user: { rol: 'vendedor' } }} />);

    await waitFor(() => {
      expect(screen.getByText('Pre-nota #1 — 23 Apr 2026')).toBeInTheDocument();
    });
  });

  test('botón "Nueva Pre-Nota" llama al endpoint POST', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 2, titulo: 'Pre-nota #2 — 23 Apr 2026' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    render(<PrenotasPage session={{ user: { rol: 'vendedor' } }} />);

    fireEvent.click(screen.getByRole('button', { name: /nueva pre-nota/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/prenotas',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('lista vacía muestra mensaje', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    render(<PrenotasPage session={{ user: { rol: 'vendedor' } }} />);

    await waitFor(() => {
      expect(
        screen.getByText(/no tienes|sin pre-notas/i)
      ).toBeInTheDocument();
    });
  });
});
