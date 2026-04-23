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

const CLIENTE_ACME = {
  id: 1,
  nombre: 'ACME',
  whatsapp: '+56912345678',
  pais: 'CHILE',
  ciudad: 'IQUIQUE',
  notas: 'test',
  total_deseados: 2,
};

describe('ClientesNuevosPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('smoke test — renderiza sin errores con lista vacía', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('conversion-sugerencias')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    const { container } = render(<ClientesNuevosPage />);

    expect(container).toBeTruthy();
  });

  test('renderiza lista de clientes — muestra nombre ACME en el DOM', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('conversion-sugerencias')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [CLIENTE_ACME] }) });
    });

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    render(<ClientesNuevosPage />);

    await waitFor(() => {
      expect(screen.getByText('ACME')).toBeInTheDocument();
    });
  });

  test('buscador filtra resultados — muestra mensaje de lista vacía', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('conversion-sugerencias')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      if (url.includes('search=')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [CLIENTE_ACME] }) });
    });

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    render(<ClientesNuevosPage />);

    await waitFor(() => {
      expect(screen.getByText('ACME')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/buscar/i);
    fireEvent.change(input, { target: { value: 'zzznoresults' } });

    await waitFor(() => {
      expect(screen.queryByText('ACME')).not.toBeInTheDocument();
    });
  });

  test('botón "Nuevo Cliente" abre formulario con campo de nombre', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('conversion-sugerencias')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });

    const { ClientesNuevosPage } = require('@/app/(app)/clientes-nuevos/client_page');
    render(<ClientesNuevosPage />);

    const boton = screen.getByRole('button', { name: /nuevo cliente/i });
    fireEvent.click(boton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/nombre/i)).toBeInTheDocument();
    });
  });
});
