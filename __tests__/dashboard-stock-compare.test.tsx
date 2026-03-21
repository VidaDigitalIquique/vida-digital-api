import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { DashboardClient } from '@/app/(app)/dashboard/client_page';

jest.mock('@/hooks/useEmpresaId', () => ({
  useEmpresaId: () => ({ empresaId: 1, isLoaded: true }),
}));

const makeStats = () => ({
  1: {
    totalProds: 10,
    inStock: 5,
    nuevos: 2,
    sinPrecio: 1,
    lastImport: null,
    despachosHoy: 0,
  },
  2: {
    totalProds: 20,
    inStock: 10,
    nuevos: 4,
    sinPrecio: 0,
    lastImport: null,
    despachosHoy: 1,
  },
});

const makeStockCompare = () => ([
  {
    empresaId: 1,
    nombre: 'SANJH',
    saldoZofriTotal: 100,
    fisicoTotal: 90,
    conSobrante: 3,
    conFaltante: 5,
    sinFisico: 2,
  },
  {
    empresaId: 2,
    nombre: 'Vida Digital',
    saldoZofriTotal: 200,
    fisicoTotal: 150,
    conSobrante: 10,
    conFaltante: 4,
    sinFisico: 1,
  },
]);

describe('Dashboard stock comparison (counts)', () => {
  test('smoke: renders section and cards', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={makeStockCompare()}
      />
    );

    expect(screen.getByText('Comparación de Stock')).toBeInTheDocument();
    expect(screen.getByText('SANJH')).toBeInTheDocument();
    expect(screen.getByText('Vida Digital')).toBeInTheDocument();
  });

  test('renders count blocks per company', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={makeStockCompare()}
      />
    );

    const cardA = screen.getByText('SANJH').closest('[data-slot="card"]') as HTMLElement;

    expect(within(cardA).getByText('productos con sobrante')).toBeInTheDocument();
    expect(within(cardA).getByText('productos con faltante')).toBeInTheDocument();
    expect(within(cardA).getByText('productos sin físico')).toBeInTheDocument();

    expect(within(cardA).getByText('3')).toBeInTheDocument();
    expect(within(cardA).getByText('5')).toBeInTheDocument();
    expect(within(cardA).getByText('2')).toBeInTheDocument();
  });

  test('renders progress bar segments', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={makeStockCompare()}
      />
    );

    const bar = screen.getByTestId('stock-compare-progress-1');
    expect(bar).toBeInTheDocument();

    expect(within(bar).getByTestId('stock-compare-seg-sobrante')).toBeInTheDocument();
    expect(within(bar).getByTestId('stock-compare-seg-faltante')).toBeInTheDocument();
    expect(within(bar).getByTestId('stock-compare-seg-sin-fisico')).toBeInTheDocument();
  });
});
