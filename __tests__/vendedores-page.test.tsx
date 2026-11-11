/**
 * @jest-environment jsdom
 *
 * S2b — Fase B (T14/T15): permisos de la pantalla /vendedores.
 */
import { render, screen } from '@testing-library/react';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/config/feature-flags.json', () => ({ 'vendedores-modulo': true }));
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
jest.mock('@/app/(app)/vendedores/VendedoresClient', () => ({
  VendedoresClient: () => 'tabla-vendedores',
}));

import { getServerSession } from 'next-auth';
import VendedoresPage from '@/app/(app)/vendedores/page';

const mockFlags = jest.requireMock('@/config/feature-flags.json') as Record<string, boolean>;

const sesion = (rol: string) => ({ user: { rol } });
const yoSoy = (rol: string | null) =>
  (getServerSession as jest.Mock).mockResolvedValue(rol ? sesion(rol) : null);

beforeEach(() => {
  mockFlags['vendedores-modulo'] = true;
  yoSoy('admin');
});

describe('/vendedores', () => {
  it('sin sesion -> /login', async () => {
    yoSoy(null);
    await expect(VendedoresPage()).rejects.toThrow('REDIRECT:/login');
  });

  it('vendedor y bodeguero -> /dashboard', async () => {
    for (const rol of ['vendedor', 'bodeguero']) {
      yoSoy(rol);
      await expect(VendedoresPage()).rejects.toThrow('REDIRECT:/dashboard');
    }
  });

  it('admin con el flag apagado -> notFound', async () => {
    mockFlags['vendedores-modulo'] = false;
    await expect(VendedoresPage()).rejects.toThrow('NOT_FOUND');
  });

  it('admin con el flag encendido -> renderiza la tabla', async () => {
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores')).toBeInTheDocument();
  });
});
