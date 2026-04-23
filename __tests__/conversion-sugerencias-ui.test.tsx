/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('@/config/feature-flags.json', () => ({ 'clientes-nuevos-visible': true }));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { rol: 'admin' } } }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/clientes-nuevos',
}));

const SUGERENCIA = {
  id: 1,
  nombre_winfac: 'SAMSUNG CHILE',
  nombre_lead: 'SAMSUNG',
  score: 0.9,
  kcodclie: 100,
  empresa_id: 2,
  estado: 'pendiente',
};

// Construye un mock de fetch que responde según la URL
function buildFetch(sugerencias: any[], clientes: any[] = []) {
  return jest.fn().mockImplementation((url: string) => {
    if (url.includes('conversion-sugerencias')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: sugerencias }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: clientes }),
    });
  });
}

// ─── Sin sugerencias ──────────────────────────────────────────────────────────

describe('ClientesNuevosPage — sin sugerencias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin sugerencias → no muestra banner', async () => {
    global.fetch = buildFetch([]);

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    render(<ClientesNuevosPage session={{ user: { rol: 'admin' } }} />);

    await waitFor(() => {
      expect(screen.queryByText(/sugerencia/i)).not.toBeInTheDocument();
    });
  });
});

// ─── Con sugerencias ─────────────────────────────────────────────────────────

describe('ClientesNuevosPage — con sugerencias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('con sugerencias → muestra banner con contador', async () => {
    global.fetch = buildFetch([SUGERENCIA]);

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    render(<ClientesNuevosPage session={{ user: { rol: 'admin' } }} />);

    await waitFor(() => {
      expect(screen.getByText(/1/)).toBeInTheDocument();
      expect(screen.getByText(/sugerencia/i)).toBeInTheDocument();
    });
  });

  test('click en sugerencia → abre modal con ambos nombres', async () => {
    global.fetch = buildFetch([SUGERENCIA]);

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    render(<ClientesNuevosPage session={{ user: { rol: 'admin' } }} />);

    // Esperar a que aparezca el banner
    await waitFor(() => {
      expect(screen.getByText(/sugerencia/i)).toBeInTheDocument();
    });

    // Click para abrir el modal/detalle
    const bannerBtn = screen.getByRole('button', { name: /SAMSUNG CHILE/i });
    fireEvent.click(bannerBtn);

    await waitFor(() => {
      expect(screen.getByText('SAMSUNG CHILE')).toBeInTheDocument();
      expect(screen.getByText('SAMSUNG')).toBeInTheDocument();
    });
  });
});

// ─── Smoke test ───────────────────────────────────────────────────────────────

describe('ClientesNuevosPage — smoke test con sugerencias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renderiza sin errores con sugerencias y clientes', async () => {
    global.fetch = buildFetch([SUGERENCIA], [{ id: 1, nombre: 'ACME', total_deseados: 0 }]);

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    const { container } = render(<ClientesNuevosPage session={{ user: { rol: 'admin' } }} />);

    expect(container).toBeTruthy();
  });
});
