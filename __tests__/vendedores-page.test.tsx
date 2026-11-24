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
  VendedoresClient: () => <div>tabla-vendedores</div>,
}));
jest.mock('@/app/(app)/vendedores/ComisionesPanel', () => ({
  ComisionesPanel: () => <div>panel-comisiones</div>,
}));
jest.mock('@/app/(app)/vendedores/GananciaPeriodoPanel', () => ({
  GananciaPeriodoPanel: () => <div>panel-ganancia</div>,
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

  it('admin con el flag encendido -> renderiza la tabla y el panel de comisiones', async () => {
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores')).toBeInTheDocument();
    expect(screen.getByText('panel-comisiones')).toBeInTheDocument();
  });
});

describe('/vendedores — seccion Ganancia por periodo (S7c-2)', () => {
  it('con el flag apagado la seccion no se monta', async () => {
    mockFlags['vendedores-ganancia-periodo'] = false;
    render(await VendedoresPage());
    expect(screen.queryByText('panel-ganancia')).not.toBeInTheDocument();
  });

  it('con el flag encendido la seccion se monta entre la tabla y comisiones', async () => {
    mockFlags['vendedores-ganancia-periodo'] = true;
    render(await VendedoresPage());
    const tabla = screen.getByText('tabla-vendedores');
    const ganancia = screen.getByText('panel-ganancia');
    const comisiones = screen.getByText('panel-comisiones');
    expect(tabla.compareDocumentPosition(ganancia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ganancia.compareDocumentPosition(comisiones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
