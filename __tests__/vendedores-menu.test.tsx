/**
 * @jest-environment jsdom
 *
 * S2b — Fase B (T16): entrada VENDEDORES en el menu, solo admin y con el flag encendido.
 */
import { cleanup, render, screen } from '@testing-library/react';

const mockEstado: { rol: string } = { rol: 'admin' };

jest.mock('@/config/feature-flags.json', () => ({ 'vendedores-modulo': true }));
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { rol: mockEstado.rol, nombre: 'Ana' } } }),
  signOut: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/contexts/AlertasContext', () => ({
  useAlertas: () => ({ alertasCount: 0, stockBajoCount: 0, seguimientosCount: 0 }),
}));
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => children,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => children,
  SheetContent: ({ children }: { children: React.ReactNode }) => children,
}));

import { TopNav } from '@/components/TopNav';
import { BottomNav } from '@/components/BottomNav';

const mockFlags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;

function linkVendedores() {
  return screen.getByText('VENDEDORES').closest('a');
}

beforeEach(() => {
  mockEstado.rol = 'admin';
  mockFlags['vendedores-modulo'] = true;
});

afterEach(cleanup);

describe('TopNav', () => {
  it('admin con el flag encendido ve VENDEDORES -> /vendedores', () => {
    render(<TopNav />);
    expect(linkVendedores()).toHaveAttribute('href', '/vendedores');
  });

  it('vendedor y bodeguero no lo ven', () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      mockEstado.rol = rol;
      render(<TopNav />);
      expect(screen.queryByText('VENDEDORES')).toBeNull();
      cleanup();
    }
  });

  it('admin con el flag apagado no lo ve', () => {
    mockFlags['vendedores-modulo'] = false;
    render(<TopNav />);
    expect(screen.queryByText('VENDEDORES')).toBeNull();
  });
});

describe('BottomNav', () => {
  it('admin con el flag encendido ve VENDEDORES -> /vendedores', () => {
    render(<BottomNav />);
    expect(linkVendedores()).toHaveAttribute('href', '/vendedores');
  });

  it('vendedor y bodeguero no lo ven', () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      mockEstado.rol = rol;
      render(<BottomNav />);
      expect(screen.queryByText('VENDEDORES')).toBeNull();
      cleanup();
    }
  });

  it('admin con el flag apagado no lo ve', () => {
    mockFlags['vendedores-modulo'] = false;
    render(<BottomNav />);
    expect(screen.queryByText('VENDEDORES')).toBeNull();
  });
});
