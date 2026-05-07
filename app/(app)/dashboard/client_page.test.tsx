/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { DashboardClient } from './client_page';
import { useEmpresaId } from '@/hooks/useEmpresaId';

// Mock hook
jest.mock('@/hooks/useEmpresaId');

const mockStats: Record<number, any> = {
  1: { totalProds: 10, inStock: 5, nuevos: 2, sinPrecio: 1, lastImport: null, despachosHoy: 0 },
  2: { totalProds: 100, inStock: 50, nuevos: 20, sinPrecio: 10, lastImport: null, despachosHoy: 5 }
};

describe('DashboardClient Sync', () => {
  it('displays the correct stats for the active empId from useEmpresaId', () => {
    // Current component (v1) ignores the mock hook because it relies on its own localStorage useEffect
    (useEmpresaId as jest.Mock).mockReturnValue({ empresaId: 2, isLoaded: true });

    render(<DashboardClient stats={mockStats} stockCompare={[]} columnas={[]} />);

    // Since stats for ID 2 has 100 products, we expect to see 100.
    // However, DashboardClient v1 will probably see ID 1 if localStorage is empty,
    // and won't respond to our mock hook.
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
