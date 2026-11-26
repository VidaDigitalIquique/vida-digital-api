/**
 * @jest-environment jsdom
 *
 * S2b — Fase B (T16): entrada VENDEDORES en el menu, solo admin y con el flag encendido.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MobileNav } from '@/components/MobileNav';

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

describe('MobileNav', () => {
  it.each(['admin', 'vendedor', 'bodeguero', 'supervisor'])('VENDEDORES respeta rol %s y flag', rol => {
    for (const enabled of [false, true]) {
      mockFlags['vendedores-modulo'] = enabled;
      render(<MobileNav rol={rol} />);
      const button = screen.getByRole('button', { name: /menú/i });
      if (button.getAttribute('aria-expanded') === 'false') fireEvent.click(button);
      if ((rol === 'admin' || rol === 'vendedor') && enabled)
        expect(linkVendedores()).toHaveAttribute('href', '/vendedores');
      else expect(screen.queryByText('VENDEDORES')).toBeNull();
      cleanup();
    }
  });
});

describe('TopNav', () => {
  it('admin con el flag encendido ve VENDEDORES -> /vendedores', () => {
    render(<TopNav />);
    expect(linkVendedores()).toHaveAttribute('href', '/vendedores');
  });

  it('vendedor con el flag encendido lo ve; bodeguero no', () => {
    mockEstado.rol = 'vendedor';
    render(<TopNav />);
    expect(linkVendedores()).toHaveAttribute('href', '/vendedores');
    cleanup();

    mockEstado.rol = 'bodeguero';
    render(<TopNav />);
    expect(screen.queryByText('VENDEDORES')).toBeNull();
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

  it('vendedor con el flag encendido ve VENDEDORES sin abrir el bloque admin', () => {
    mockEstado.rol = 'vendedor';
    render(<BottomNav />);
    expect(linkVendedores()).toHaveAttribute('href', '/vendedores');
    // El bloque admin no se ensancha: el vendedor no ve sus entradas.
    expect(screen.queryByText('Sueldos')).toBeNull();
    expect(screen.queryByText('Pettycash')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
  });

  it('vendedor sin el flag no lo ve; bodeguero nunca', () => {
    mockEstado.rol = 'vendedor';
    mockFlags['vendedores-modulo'] = false;
    render(<BottomNav />);
    expect(screen.queryByText('VENDEDORES')).toBeNull();
    cleanup();

    mockFlags['vendedores-modulo'] = true;
    mockEstado.rol = 'bodeguero';
    render(<BottomNav />);
    expect(screen.queryByText('VENDEDORES')).toBeNull();
  });

  it('admin con el flag apagado no lo ve', () => {
    mockFlags['vendedores-modulo'] = false;
    render(<BottomNav />);
    expect(screen.queryByText('VENDEDORES')).toBeNull();
  });
});
