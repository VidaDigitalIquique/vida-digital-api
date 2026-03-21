import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
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
    totalConFisico: 8,
  },
]);

describe('Dashboard stock comparison drawer', () => {
  test('opens sobrante drawer when clicking the count', async () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={makeStockCompare()}
      />
    );

    fireEvent.click(screen.getByText('3'));

    expect(await screen.findByText('Productos con sobrante — SANJH')).toBeInTheDocument();
    expect(screen.getByText('Código')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
    expect(screen.getByText('Saldo Zofri')).toBeInTheDocument();
    expect(screen.getByText('Físico')).toBeInTheDocument();
    expect(screen.getByText('Diferencia')).toBeInTheDocument();
  });

  test('opens faltante drawer when clicking the count', async () => {
    render(
      <DashboardClient
        stats={makeStats()}
        stockCompare={makeStockCompare()}
      />
    );

    fireEvent.click(screen.getByText('productos con faltante').nextElementSibling as HTMLElement);

    expect(await screen.findByText('Productos con faltante — SANJH')).toBeInTheDocument();
    expect(screen.getByText('Código')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
    expect(screen.getByText('Saldo Zofri')).toBeInTheDocument();
    expect(screen.getByText('Físico')).toBeInTheDocument();
    expect(screen.getByText('Diferencia')).toBeInTheDocument();
  });
});
