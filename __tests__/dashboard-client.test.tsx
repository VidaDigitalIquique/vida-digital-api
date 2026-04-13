/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardClient } from '@/app/(app)/dashboard/client_page';

jest.mock('@/hooks/useEmpresaId', () => ({
  useEmpresaId: () => ({ empresaId: 0, isLoaded: false }),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

jest.mock('date-fns', () => ({
  format: (date: Date) => (date instanceof Date ? date.toISOString() : String(date)),
}));

jest.mock('date-fns/locale', () => ({
  es: {},
}));

const stats = {
  1: {
    totalProds: 100,
    inStock: 80,
    nuevos: 10,
    sinPrecio: 5,
    despachosHoy: 2,
    lastImport: '2024-01-01T10:00:00.000Z',
  },
  2: {
    totalProds: 200,
    inStock: 150,
    nuevos: 20,
    sinPrecio: 8,
    despachosHoy: 4,
    lastImport: '2024-01-02T12:00:00.000Z',
  },
};

const stockCompare = [
  {
    empresaId: 1,
    nombre: 'IMPORT EXPORT SANJH LTDA.',
    saldoZofriTotal: 1000,
    fisicoTotal: 900,
    conSobrante: 5,
    conFaltante: 3,
    sinFisico: 2,
    totalConFisico: 10,
  },
  {
    empresaId: 2,
    nombre: 'IMPORT EXPORT VIDA DIGITAL LTDA.',
    saldoZofriTotal: 2000,
    fisicoTotal: 1800,
    conSobrante: 8,
    conFaltante: 6,
    sinFisico: 4,
    totalConFisico: 18,
  },
];

describe('DashboardClient (Slice 5)', () => {
  test('Renderiza stats de ambas empresas sin localStorage', () => {
    render(<DashboardClient stats={stats} stockCompare={stockCompare} despachosRecientes={[]} />);
  expect(screen.getAllByText(/SANJH/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/VIDA DIGITAL/i).length).toBeGreaterThan(0);
  });

  test('Muestra fecha de última importación por cada empresa', () => {
    render(<DashboardClient stats={stats} stockCompare={stockCompare} despachosRecientes={[]} />);
    expect(screen.getByText('2024-01-01T10:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('2024-01-02T12:00:00.000Z')).toBeInTheDocument();
  });

  test('No retorna null cuando no hay localStorage', () => {
    const { container } = render(<DashboardClient stats={stats} stockCompare={stockCompare} despachosRecientes={[]} />);
    expect(container.textContent).toBeTruthy();
  });
});
