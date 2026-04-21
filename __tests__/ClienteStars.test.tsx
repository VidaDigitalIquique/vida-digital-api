/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Mock del JSON sin virtual — el módulo existe en disco, virtual:true lo ignora.
// Este mock aplica a todos los tests de este archivo (flag encendido por defecto).
jest.mock('@/config/feature-flags.json', () => ({ 'cliente-stars-visible': true }));

const mockFetch = (estrellas: number) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ estrellas }),
  } as any);
};

// Import después del mock top-level para que el componente ya reciba el flag en true.
import { ClienteStars } from '@/components/ClienteStars';

describe('ClienteStars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loading state — renderiza 5 estrellas con clase text-gray-300', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves

    const { container } = render(<ClienteStars kcodclie="CLI001" />);

    const stars = container.querySelectorAll('.text-gray-300');
    expect(stars.length).toBe(5);
  });

  test('0 estrellas → no renderiza nada', async () => {
    mockFetch(0);

    const { container } = render(<ClienteStars kcodclie="CLI001" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clientes/CLI001/rating');
    });

    await waitFor(() => {
      const stars = container.querySelectorAll('[data-filled]');
      expect(stars.length).toBe(0);
    });
  });

  test('3 estrellas → 3 filled y 2 empty', async () => {
    mockFetch(3);

    const { container } = render(<ClienteStars kcodclie="CLI001" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clientes/CLI001/rating');
    });

    await waitFor(() => {
      const filled = container.querySelectorAll('[data-filled="true"]');
      const empty  = container.querySelectorAll('[data-filled="false"]');
      expect(filled.length).toBe(3);
      expect(empty.length).toBe(2);
    });
  });

  test('error de fetch → no renderiza nada', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { container } = render(<ClienteStars kcodclie="CLI001" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clientes/CLI001/rating');
    });

    await waitFor(() => {
      const stars = container.querySelectorAll('[data-filled]');
      expect(stars.length).toBe(0);
    });
  });

  test('feature flag apagado → no renderiza nada', async () => {
    mockFetch(5);

    const { container } = render(<ClienteStars kcodclie="CLI001" _flagOverride={false} />);

    // esperar un tick para confirmar que fetch no se llamó
    await new Promise(r => setTimeout(r, 50));

    expect(global.fetch).not.toHaveBeenCalled();
    const stars = container.querySelectorAll('[data-filled]');
    expect(stars.length).toBe(0);
  });
});
