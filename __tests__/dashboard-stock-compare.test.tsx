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

describe('Dashboard stock comparison section (red first)', () => {
  test('renders comparison section with two company cards', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={[
          { empresaId: 1, nombre: 'SANJH', saldoZofriTotal: 100, fisicoTotal: 120 },
          { empresaId: 2, nombre: 'Vida Digital', saldoZofriTotal: 200, fisicoTotal: 150 },
        ]}
      />
    );

    expect(screen.getByText('Comparación de Stock')).toBeInTheDocument();
    expect(screen.getByText('SANJH')).toBeInTheDocument();
    expect(screen.getByText('Vida Digital')).toBeInTheDocument();
  });

  test('shows correct totals and positive difference for SANJH', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={[
          { empresaId: 1, nombre: 'SANJH', saldoZofriTotal: 100, fisicoTotal: 120 },
          { empresaId: 2, nombre: 'Vida Digital', saldoZofriTotal: 200, fisicoTotal: 150 },
        ]}
      />
    );

    const card = screen.getByText('SANJH').closest('[data-slot="card"]') as HTMLElement;

    expect(within(card).getByText('Saldo Zofri total')).toBeInTheDocument();
    expect(within(card).getByText('Físico total')).toBeInTheDocument();
    expect(within(card).getByText('Diferencia')).toBeInTheDocument();

    expect(within(card).getByText('100')).toBeInTheDocument();
    expect(within(card).getByText('120')).toBeInTheDocument();

    const diff = within(card).getByText('+20');
    expect(diff).toBeInTheDocument();
    expect(diff.className).toMatch(/text-emerald/);
  });

  test('shows correct totals and negative difference for Vida Digital', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={[
          { empresaId: 1, nombre: 'SANJH', saldoZofriTotal: 100, fisicoTotal: 120 },
          { empresaId: 2, nombre: 'Vida Digital', saldoZofriTotal: 200, fisicoTotal: 150 },
        ]}
      />
    );

    const card = screen.getByText('Vida Digital').closest('[data-slot="card"]') as HTMLElement;

    expect(within(card).getByText('200')).toBeInTheDocument();
    expect(within(card).getByText('150')).toBeInTheDocument();

    const diff = within(card).getByText('-50');
    expect(diff).toBeInTheDocument();
    expect(diff.className).toMatch(/text-red/);
  });
});
