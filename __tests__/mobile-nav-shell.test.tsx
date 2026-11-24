/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '@/components/AppShell';
jest.mock('@/config/feature-flags.json', () => ({ 'menu-movil-v2': false, 'vendedores-modulo': true }));
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams() }));
jest.mock('next-auth/react', () => ({ SessionProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="session">{children}</div>, signOut: jest.fn() }));
jest.mock('@/contexts/AlertasContext', () => ({ AlertasProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="alertas">{children}</div>, useAlertas: () => ({ alertasCount: 0, stockBajoCount: 0, seguimientosCount: 0 }) }));
jest.mock('@/components/TopNav', () => ({ TopNav: () => <div data-testid="top" /> }));
jest.mock('@/components/Toolbar', () => ({ Toolbar: () => <div data-testid="toolbar" /> }));
jest.mock('@/components/BottomNav', () => ({ BottomNav: () => <div data-testid="bottom" /> }));
const flags = jest.requireMock('@/config/feature-flags.json');
afterEach(cleanup);
test.each(['admin', 'vendedor', 'bodeguero'])('flag apagado conserva layout %s', rol => {
  flags['menu-movil-v2'] = false;
  const session = { expires: '2099-01-01', user: { name: 'Prueba', rol } };
  render(<AppShell session={session}>Contenido</AppShell>);
  expect(screen.getByRole('link', { name: 'VidaDigital' })).toHaveAttribute('href', rol === 'bodeguero' ? '/bodega' : '/dashboard');
  expect(screen.getByTestId('bottom').parentElement).toHaveClass('min-h-screen', 'pt-16', 'md:pt-16', 'pb-16', 'md:pb-0');
  expect(screen.queryByRole('button', { name: /menú/i })).toBeNull();
});
test('smoke integrado: home abre, VENDEDORES navega y cierra sin barra inferior', () => {
  flags['menu-movil-v2'] = true;
  const session = { expires: '2099-01-01', user: { name: 'Prueba', rol: 'admin' } };
  render(<AppShell session={session}>Contenido</AppShell>);
  const link = screen.getByRole('link', { name: 'VENDEDORES' });
  expect(link).toHaveAttribute('href', '/vendedores'); fireEvent.click(link);
  expect(screen.queryByRole('navigation')).toBeNull(); expect(screen.queryByTestId('bottom')).toBeNull();
  expect(screen.getByRole('main').parentElement).not.toHaveClass('pb-16');
  expect(screen.getByTestId('top')).toBeInTheDocument(); expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  expect(screen.getAllByTestId('alertas')).toHaveLength(1);
  expect(screen.getByTestId('session')).toContainElement(screen.getByTestId('alertas'));
});
