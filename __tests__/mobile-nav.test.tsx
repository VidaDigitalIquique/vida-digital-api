/** @jest-environment jsdom */
import React, { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MobileNav } from '@/components/MobileNav';
import { signOut } from 'next-auth/react';

let mockPath = '/dashboard';
let mockQuery = '';
let mockCount = 0;
jest.mock('next/navigation', () => ({ usePathname: () => mockPath, useSearchParams: () => new URLSearchParams(mockQuery) }));
jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
jest.mock('@/contexts/AlertasContext', () => ({ useAlertas: () => ({ alertasCount: mockCount, stockBajoCount: mockCount, seguimientosCount: mockCount }) }));
jest.mock('@/config/feature-flags.json', () => ({ seguimientos: true, 'vendedores-modulo': true }));
const flags = jest.requireMock('@/config/feature-flags.json');
const logo = () => screen.getByRole('button', { name: /menú/i });
const ventas = [['/precios', 'Sala de Venta'], ['/ventas/kardex', 'Kardex Cliente'], ['/admin/importar', 'Sincronizar WinFac'], ['/garantias', 'Garantías'], ['/caja-mayor', 'Caja Mayor'], ['/prenotas', 'Pre-Notas'], ['/clientes-nuevos', 'Clientes Nuevos']];
const catalogo = [['/catalogo/admin', 'Crear Catálogo'], ['/catalogo/clientes', 'Catálogos por Cliente'], ['/admin/categorias', 'Categorías'], ['/deseados?modo=china', 'Pedir a China']];
const bodega = [['/bodega', 'Ubicaciones en Bodega'], ['/bodega/despachos', 'Despachos'], ['/bodega/registro-notas', 'Registro de Notas']];
const admin = [['/admin/importar', 'Sincronizar WinFac'], ['/admin/subir-imagenes', 'Subir Imágenes'], ['/admin/usuarios', 'Usuarios'], ['/admin/kardex-exclusiones', 'Exclusiones Kardex'], ['/admin/caja-config', 'Caja Mayor Config'], ['/pettycash', 'Pettycash'], ['/sueldos', 'Sueldos']];
beforeEach(() => { mockPath = '/dashboard'; mockQuery = ''; mockCount = 0; flags.seguimientos = true; flags['vendedores-modulo'] = true; jest.clearAllMocks(); });
afterEach(cleanup);

describe.each(['admin', 'vendedor', 'bodeguero', 'supervisor'])('inventario exacto %s', rol => {
  test.each([[false, false], [false, true], [true, false], [true, true]])('flags seguimientos=%s vendedores=%s', (seguimientos, vendedores) => {
    flags.seguimientos = seguimientos; flags['vendedores-modulo'] = vendedores;
    mockPath = '/secundaria';
    render(<MobileNav rol={rol} />); fireEvent.click(logo());
    const comercial = rol === 'admin' || rol === 'vendedor';
    const esperado = [
      ...(comercial ? ventas : rol === 'supervisor' ? ventas.slice(-1) : []),
      ...(comercial ? catalogo : []), ...(rol !== 'supervisor' ? bodega : []),
      ...(comercial ? [['/deseados', 'Deseados']] : []),
      ...(comercial && seguimientos ? [['/seguimientos', 'Seguimientos']] : []),
      ...(rol !== 'supervisor' ? [['/deudas', rol === 'admin' ? 'Deudas' : 'Mis Deudas']] : []),
      ...(rol === 'admin' ? admin : []), ...(rol === 'admin' && vendedores ? [['/vendedores', 'VENDEDORES']] : []),
    ];
    expect(screen.getAllByRole('link').map(a => [a.getAttribute('href'), a.textContent])).toEqual(esperado);
    const salir = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(salir).toHaveClass('min-h-[44px]');
    expect(screen.getByRole('navigation').lastElementChild).toBe(salir);
    fireEvent.click(salir); expect(signOut).toHaveBeenCalledTimes(1);
  });
});
test.each([['admin', '/dashboard', true], ['vendedor', '/precios', true], ['bodeguero', '/bodega', true], ['admin', '/vendedores', false], ['bodeguero', '/bodega/despachos', false], ['supervisor', '/dashboard', false], [undefined, '/dashboard', false]] as const)('inicio estricto %s %s', (rol, ruta, abierto) => {
  mockPath = ruta; render(<StrictMode><MobileNav rol={rol} /></StrictMode>);
  expect(logo()).toHaveAttribute('aria-expanded', String(abierto));
  expect(Boolean(screen.queryByRole('navigation'))).toBe(abierto);
});
test('cambio de ruta y regreso a home no reabren', () => {
  const view = render(<MobileNav rol="admin" />);
  mockPath = '/vendedores'; view.rerender(<MobileNav rol="admin" />);
  mockPath = '/dashboard'; view.rerender(<MobileNav rol="admin" />);
  expect(screen.queryByRole('navigation')).toBeNull();
});
test.each(['/precios', '/deseados?modo=china'])('enlace actual o query cierra %s', href => {
  mockPath = href.split('?')[0]; render(<MobileNav rol="vendedor" />);
  if (!screen.queryByRole('navigation')) fireEvent.click(logo());
  fireEvent.click(screen.getAllByRole('link').find(a => a.getAttribute('href') === href)!);
  expect(screen.queryByRole('navigation')).toBeNull();
});
test('logo alterna y el panel cerrado no deja enlaces enfocables', () => {
  render(<MobileNav rol="admin" />); fireEvent.click(logo());
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  fireEvent.click(logo()); expect(screen.getByRole('navigation')).toBeInTheDocument();
});
test('Escape cierra y devuelve foco; listeners se limpian', () => {
  const remove = jest.spyOn(document, 'removeEventListener');
  const view = render(<MobileNav rol="admin" />);
  screen.getByRole('link', { name: 'Sala de Venta' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(logo()).toHaveFocus(); expect(screen.queryByRole('navigation')).toBeNull();
  view.unmount(); expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function)); remove.mockRestore();
});
test('toque interior conserva y exterior cierra', () => {
  render(<MobileNav rol="admin" />);
  fireEvent.pointerDown(screen.getByRole('heading', { name: 'Ventas' }));
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  fireEvent.pointerDown(document.body); expect(screen.queryByRole('navigation')).toBeNull();
});

test('QA-12: tocar la franja del header fuera del logo cierra', () => {
  render(<MobileNav rol="admin" />);
  fireEvent.pointerDown(screen.getByRole('banner'));
  expect(screen.queryByRole('navigation')).toBeNull();
  expect(logo()).toHaveAttribute('aria-expanded', 'false');
});

test('QA-12: pointerdown y click del logo alternan una sola vez; el panel conserva', () => {
  render(<MobileNav rol="admin" />);
  fireEvent.pointerDown(screen.getByRole('navigation'));
  expect(logo()).toHaveAttribute('aria-expanded', 'true');
  fireEvent.pointerDown(logo());
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  fireEvent.click(logo());
  expect(screen.queryByRole('navigation')).toBeNull();
  fireEvent.pointerDown(logo());
  fireEvent.click(logo());
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

test('EXP-1: panel por encima de sticky z-40, flotantes z-50 y tooltip zIndex 9999', () => {
  mockPath = '/precios'; render(<MobileNav rol="vendedor" />);
  const layer = screen.getByRole('navigation').className.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/);
  const zIndex = Number(layer?.[1] ?? layer?.[2]);
  expect(zIndex).toBeGreaterThan(9999);
});
test('alertas actualizadas 0/1/99/100 no cierran ni duplican badges', () => {
  const view = render(<MobileNav rol="admin" />);
  for (const count of [0, 1, 99, 100]) {
    mockCount = count; view.rerender(<MobileNav rol="admin" />);
    for (const name of ['Deseados', 'Pedir a China', 'Seguimientos']) {
      const link = screen.getByRole('link', { name: new RegExp(name) });
      const badges = within(link).queryAllByText(count > 99 ? '99+' : String(count));
      expect(badges).toHaveLength(count ? 1 : 0);
    }
  }
});
test('query distingue China y Deseados; panel accesible y desplazable', () => {
  mockPath = '/deseados'; mockQuery = 'modo=china'; render(<MobileNav rol="admin" />); fireEvent.click(logo());
  expect(screen.getByRole('link', { name: 'Pedir a China' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Deseados' })).not.toHaveAttribute('aria-current');
  const panel = screen.getByRole('navigation');
  expect(logo()).toHaveAttribute('aria-controls', panel.id);
  expect(logo()).toHaveClass('min-h-[44px]');
  expect(panel).toHaveClass('fixed', 'top-16', 'overflow-y-auto', 'overscroll-contain', 'max-h-[calc(100dvh-4rem)]', 'md:hidden');
  screen.getAllByRole('link').forEach(a => expect(a).toHaveClass('min-h-[44px]'));
});
