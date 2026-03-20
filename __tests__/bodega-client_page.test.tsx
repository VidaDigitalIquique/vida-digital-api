import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { BodegaClient } from '@/app/(app)/bodega/client_page';
import { LoteBodega, UbicacionBodegaAgrupada } from '@/types';

jest.mock('@/hooks/useEmpresaId', () => ({
  useEmpresaId: () => ({ empresaId: 1, isLoaded: true }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

jest.mock('@/components/ui/sheet', () => {
  const React = require('react');
  return {
    Sheet: ({ children }: any) => <div>{children}</div>,
    SheetContent: ({ children }: any) => <div>{children}</div>,
    SheetHeader: ({ children }: any) => <div>{children}</div>,
    SheetTitle: ({ children }: any) => <div>{children}</div>,
    SheetDescription: ({ children }: any) => <div>{children}</div>,
  };
});

const makeLote = (overrides: Partial<LoteBodega>): LoteBodega => ({
  id: 1,
  nroingreso: 'ING-1',
  ubicacion: 'A1',
  saldo: 20,
  saldocajas: 2,
  fisico: 20,
  diferencia: 0,
  observaciones: null,
  updated_at: new Date('2026-03-20T00:00:00Z'),
  ...overrides,
});

const makeUbicacion = (overrides: Partial<UbicacionBodegaAgrupada>): UbicacionBodegaAgrupada => ({
  codigo: 'P001',
  detalle: 'Producto prueba',
  producto_imagen_url: null,
  empresa_id: 1,
  saldo_total: 100,
  cantcaja: 10,
  umed: 'u',
  fisico_total: 25,
  diferencia_total: -5,
  ubicaciones: ['A1', 'B1'],
  lotes: [
    makeLote({ id: 1, nroingreso: 'ING-1', ubicacion: 'A1', saldo: 20, fisico: 20, diferencia: 0 }),
    makeLote({ id: 2, nroingreso: 'ING-2', ubicacion: 'B1', saldo: 10, fisico: 5, diferencia: -5 }),
  ],
  ...overrides,
});

const renderAndOpenLote = async (initial: UbicacionBodegaAgrupada, updatedData: Partial<LoteBodega>) => {
  (global.fetch as jest.Mock) = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api/ubicaciones?')) {
      return {
        ok: true,
        json: async () => ({ data: [initial] }),
      } as Response;
    }
    if (url.startsWith('/api/ubicaciones/1') && init?.method === 'PUT') {
      return {
        ok: true,
        json: async () => ({ data: updatedData }),
      } as Response;
    }
    throw new Error(`Unhandled fetch: ${url}`);
  });

  render(<BodegaClient session={{}} empresasMap={{ 1: 'sanjh' }} />);

  const searchInput = screen.getByPlaceholderText(/buscar/i);
  fireEvent.change(searchInput, { target: { value: 'P0' } });

  await act(async () => {
    jest.advanceTimersByTime(300);
  });

  await screen.findByText('P001');

  fireEvent.click(screen.getByText('P001'));

  const ingreso = screen.getByText('ING-1');
  fireEvent.click(ingreso.closest('button')!);

  const panel = screen.getByText('Guardar lote').closest('div') as HTMLElement;
  return { panel };
};

describe('BodegaClient handleLoteUpdated side effects (red first)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('after handleLoteUpdated, fisico_total on card reflects updated lotes sum', async () => {
    const initial = makeUbicacion({});
    const updatedData = { fisico: 32, diferencia: 12, updated_at: new Date('2026-03-20T01:00:00Z') };

    const { panel } = await renderAndOpenLote(initial, updatedData);

    const spinbuttons = within(panel).getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], { target: { value: '3' } });
    fireEvent.change(spinbuttons[1], { target: { value: '2' } });

    fireEvent.click(within(panel).getByText('Guardar lote'));

    expect(await screen.findByText('37 u')).toBeInTheDocument();
  });

  test('after handleLoteUpdated, diferencia_total is recalculated correctly', async () => {
    const initial = makeUbicacion({});
    const updatedData = { fisico: 32, diferencia: 12, updated_at: new Date('2026-03-20T01:00:00Z') };

    const { panel } = await renderAndOpenLote(initial, updatedData);

    const spinbuttons = within(panel).getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], { target: { value: '3' } });
    fireEvent.change(spinbuttons[1], { target: { value: '2' } });

    fireEvent.click(within(panel).getByText('Guardar lote'));

    expect(await screen.findByText('+7 u')).toBeInTheDocument();
  });

  test('after handleLoteUpdated, ubicaciones on card show new locations without empty or duplicates', async () => {
    const initial = makeUbicacion({
      lotes: [
        makeLote({ id: 1, nroingreso: 'ING-1', ubicacion: 'A1', saldo: 20, fisico: 20, diferencia: 0 }),
        makeLote({ id: 2, nroingreso: 'ING-2', ubicacion: 'B1', saldo: 10, fisico: 5, diferencia: -5 }),
        makeLote({ id: 3, nroingreso: 'ING-3', ubicacion: '', saldo: 5, fisico: 0, diferencia: -5 }),
      ],
      ubicaciones: ['A1', 'B1'],
    });
    const updatedData = { fisico: 32, diferencia: 12, updated_at: new Date('2026-03-20T01:00:00Z') };

    const { panel } = await renderAndOpenLote(initial, updatedData);

    const ubicacionLabel = within(panel).getByText('Código de ubicación');
    const ubicacionInput = ubicacionLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(ubicacionInput, { target: { value: 'B1' } });

    const spinbuttons = within(panel).getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], { target: { value: '3' } });
    fireEvent.change(spinbuttons[1], { target: { value: '2' } });

    fireEvent.click(within(panel).getByText('Guardar lote'));

    const ubicacionesSection = screen.getByText('Ubicaciones en bodega').parentElement as HTMLElement;
    await waitFor(() => {
      expect(within(ubicacionesSection).queryByText('A1')).toBeNull();
      expect(within(ubicacionesSection).getAllByText('B1')).toHaveLength(1);
    });
  });
});
