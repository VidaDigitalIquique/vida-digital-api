/**
 * @jest-environment jsdom
 *
 * S2b — Fase B (T14/T15): permisos de la pantalla /vendedores.
 */
import { render, screen } from '@testing-library/react';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/config/feature-flags.json', () => ({
  'vendedores-modulo': true,
  'vendedores-buscador': false,
  'vendedores-buscador-codigo': false,
  'vendedores-comisiones-margen': false,
}));
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
jest.mock('@/app/(app)/vendedores/VendedoresClient', () => ({
  VendedoresClient: ({
    puedeVerDetalle,
    buscadorActivo,
    buscadorCodigoActivo,
  }: {
    puedeVerDetalle?: boolean;
    buscadorActivo?: boolean;
    buscadorCodigoActivo?: boolean;
  }) => (
    <>
      <div>{`tabla-vendedores:detalle=${String(puedeVerDetalle)}`}</div>
      <div>{`tabla-vendedores:buscador=${String(buscadorActivo)}`}</div>
      <div>{`tabla-vendedores:buscador-codigo=${String(buscadorCodigoActivo)}`}</div>
    </>
  ),
}));
jest.mock('@/app/(app)/vendedores/ComisionesPanel', () => ({
  ComisionesPanel: ({
    puedeEditarPct,
    mostrarMargen,
  }: {
    puedeEditarPct?: boolean;
    mostrarMargen?: boolean;
  }) => (
    <>
      <div>{`panel-comisiones:editar=${String(puedeEditarPct)}`}</div>
      <div>{`panel-comisiones:margen=${String(mostrarMargen)}`}</div>
    </>
  ),
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
  mockFlags['vendedores-buscador'] = false;
  mockFlags['vendedores-buscador-codigo'] = false;
  mockFlags['vendedores-comisiones-margen'] = false;
  yoSoy('admin');
});

describe('/vendedores', () => {
  it('sin sesion -> /login', async () => {
    yoSoy(null);
    await expect(VendedoresPage()).rejects.toThrow('REDIRECT:/login');
  });

  it('bodeguero -> /dashboard', async () => {
    yoSoy('bodeguero');
    await expect(VendedoresPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('vendedor NO redirige: ve la tabla y las comisiones', async () => {
    yoSoy('vendedor');
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores:detalle=false')).toBeInTheDocument();
    expect(screen.getByText('panel-comisiones:editar=false')).toBeInTheDocument();
  });

  it('admin con el flag apagado -> notFound', async () => {
    mockFlags['vendedores-modulo'] = false;
    await expect(VendedoresPage()).rejects.toThrow('NOT_FOUND');
  });

  it('admin con el flag encendido -> tabla y comisiones con edicion habilitada', async () => {
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores:detalle=true')).toBeInTheDocument();
    expect(screen.getByText('panel-comisiones:editar=true')).toBeInTheDocument();
  });
});

describe('/vendedores — buscador de notas (s15b)', () => {
  it('con el flag apagado el buscador no se activa', async () => {
    mockFlags['vendedores-buscador'] = false;
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores:buscador=false')).toBeInTheDocument();
  });

  it('con el flag encendido el buscador se activa', async () => {
    mockFlags['vendedores-buscador'] = true;
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores:buscador=true')).toBeInTheDocument();
  });
});

describe('/vendedores — buscador por codigo de producto (s26)', () => {
  it('con el flag apagado se pasa buscadorCodigoActivo=false', async () => {
    mockFlags['vendedores-buscador'] = true;
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores:buscador-codigo=false')).toBeInTheDocument();
  });

  it('con el flag encendido se pasa buscadorCodigoActivo=true', async () => {
    mockFlags['vendedores-buscador'] = true;
    mockFlags['vendedores-buscador-codigo'] = true;
    render(await VendedoresPage());
    expect(screen.getByText('tabla-vendedores:buscador-codigo=true')).toBeInTheDocument();
  });
});

describe('/vendedores — columna % sobre el costo (s16)', () => {
  it('admin con el flag encendido -> mostrarMargen=true', async () => {
    mockFlags['vendedores-comisiones-margen'] = true;
    render(await VendedoresPage());
    expect(screen.getByText('panel-comisiones:margen=true')).toBeInTheDocument();
  });

  it('admin con el flag apagado -> mostrarMargen=false', async () => {
    render(await VendedoresPage());
    expect(screen.getByText('panel-comisiones:margen=false')).toBeInTheDocument();
  });

  it.each([true, false])('vendedor con el flag %p -> mostrarMargen=false (solo admin)', async (on) => {
    mockFlags['vendedores-comisiones-margen'] = on;
    yoSoy('vendedor');
    render(await VendedoresPage());
    expect(screen.getByText('panel-comisiones:margen=false')).toBeInTheDocument();
  });
});

describe('/vendedores — seccion Ganancia por periodo (S7c-2)', () => {
  it('con el flag apagado la seccion no se monta', async () => {
    mockFlags['vendedores-ganancia-periodo'] = false;
    render(await VendedoresPage());
    expect(screen.queryByText('panel-ganancia')).not.toBeInTheDocument();
  });

  it('admin con el flag encendido la seccion se monta entre la tabla y comisiones', async () => {
    mockFlags['vendedores-ganancia-periodo'] = true;
    render(await VendedoresPage());
    const tabla = screen.getByText('tabla-vendedores:detalle=true');
    const ganancia = screen.getByText('panel-ganancia');
    const comisiones = screen.getByText('panel-comisiones:editar=true');
    expect(tabla.compareDocumentPosition(ganancia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ganancia.compareDocumentPosition(comisiones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('vendedor NO monta la seccion aunque el flag este encendido', async () => {
    mockFlags['vendedores-ganancia-periodo'] = true;
    yoSoy('vendedor');
    render(await VendedoresPage());
    expect(screen.queryByText('panel-ganancia')).not.toBeInTheDocument();
  });
});
