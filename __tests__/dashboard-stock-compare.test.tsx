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

const makeProducts = () => ([
  { codigo: 'P-03', saldo: 5, fisico_total: 2 },
  { codigo: 'P-02', saldo: 25, fisico_total: 30 },
  { codigo: 'P-01', saldo: 100, fisico_total: 150 },
]);

describe('Dashboard stock comparison (red first)', () => {
  test('renders summary + chart for each company', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={[
          {
            empresaId: 1,
            nombre: 'SANJH',
            saldoZofriTotal: 100,
            fisicoTotal: 150,
            productos: makeProducts(),
          },
          {
            empresaId: 2,
            nombre: 'Vida Digital',
            saldoZofriTotal: 200,
            fisicoTotal: 50,
            productos: makeProducts(),
          },
        ]}
      />
    );

    expect(screen.getByText('Comparación de Stock')).toBeInTheDocument();

    const cardA = screen.getByText('SANJH').closest('[data-slot="card"]') as HTMLElement;
    const cardB = screen.getByText('Vida Digital').closest('[data-slot="card"]') as HTMLElement;

    expect(cardA).toBeInTheDocument();
    expect(cardB).toBeInTheDocument();

    expect(screen.getByTestId('stock-compare-chart-1')).toBeInTheDocument();
    expect(screen.getByTestId('stock-compare-chart-2')).toBeInTheDocument();
  });

  test('shows coverage percent and colored difference', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={[
          {
            empresaId: 1,
            nombre: 'SANJH',
            saldoZofriTotal: 100,
            fisicoTotal: 150,
            productos: makeProducts(),
          },
          {
            empresaId: 2,
            nombre: 'Vida Digital',
            saldoZofriTotal: 200,
            fisicoTotal: 50,
            productos: makeProducts(),
          },
        ]}
      />
    );

    const cardA = screen.getByText('SANJH').closest('[data-slot="card"]') as HTMLElement;
    const cardB = screen.getByText('Vida Digital').closest('[data-slot="card"]') as HTMLElement;

    expect(within(cardA).getByText('Saldo Zofri total')).toBeInTheDocument();
    expect(within(cardA).getByText('Físico total')).toBeInTheDocument();
    expect(within(cardA).getByText('Diferencia')).toBeInTheDocument();
    expect(within(cardA).getByText('% de cobertura física')).toBeInTheDocument();

    const coverageA = within(cardA).getByText('101%');
    expect(coverageA).toBeInTheDocument();
    expect(coverageA.className).toMatch(/text-emerald/);

    const diffA = within(cardA).getByText('+50');
    expect(diffA).toBeInTheDocument();
    expect(diffA.className).toMatch(/text-emerald/);

    const coverageB = within(cardB).getByText('25%');
    expect(coverageB).toBeInTheDocument();
    expect(coverageB.className).toMatch(/text-red/);

    const diffB = within(cardB).getByText('-150');
    expect(diffB).toBeInTheDocument();
    expect(diffB.className).toMatch(/text-red/);
  });

  test('renders gray coverage when there is no physical data', () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={[
          {
            empresaId: 1,
            nombre: 'SANJH',
            saldoZofriTotal: 100,
            fisicoTotal: null,
            productos: makeProducts(),
          },
        ]}
      />
    );

    const card = screen.getByText('SANJH').closest('[data-slot="card"]') as HTMLElement;

    const coverage = within(card).getAllByText('—').find(el => el.className.includes('text-zinc-500'))!;
    expect(coverage).toBeInTheDocument();
    expect(coverage.className).toMatch(/text-zinc-500/);
  });
});
