import { render, screen } from '@testing-library/react';
import { Toolbar } from './Toolbar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('@/contexts/AlertasContext', () => ({
  useAlertas: () => ({ alertasCount: 0, stockBajoCount: 0 }),
}));

describe('Toolbar', () => {
  it('muestra los 7 ítems para admin', () => {
    render(<Toolbar isAdmin={true} />);
    expect(screen.getByText('Pre-notas')).toBeInTheDocument();
    expect(screen.getByText('Clientes Nuevos')).toBeInTheDocument();
    expect(screen.getByText('Deseados')).toBeInTheDocument();
    expect(screen.getByText('China')).toBeInTheDocument();
    expect(screen.getByText('Pettycash')).toBeInTheDocument();
    expect(screen.getByText('Deudas')).toBeInTheDocument();
    expect(screen.getByText('Sueldos')).toBeInTheDocument();
  });

  it('oculta Pettycash y Sueldos para no-admin', () => {
    render(<Toolbar isAdmin={false} />);
    expect(screen.queryByText('Pettycash')).not.toBeInTheDocument();
    expect(screen.queryByText('Deudas')).not.toBeInTheDocument();
    expect(screen.queryByText('Sueldos')).not.toBeInTheDocument();
    expect(screen.getByText('Pre-notas')).toBeInTheDocument();
  });
});
