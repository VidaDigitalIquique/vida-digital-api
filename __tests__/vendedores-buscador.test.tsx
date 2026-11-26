/**
 * @jest-environment jsdom
 *
 * s15b — Fase B: buscador de notas por numero de nota o cliente en /vendedores (F1).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { VendedoresClient } from '@/app/(app)/vendedores/VendedoresClient';
import { BuscadorNotas } from '@/app/(app)/vendedores/BuscadorNotas';

const NOMBRE = 'Buscar por N° de nota o cliente';
const combo = () => screen.getByRole('combobox', { name: NOMBRE }) as HTMLInputElement;

type Fila = {
  empresa: 'vida' | 'sanjh';
  empresa_nombre: string;
  fecha_venta: string;
  nota: string;
  cliente: string;
  vendedor: string;
  total_usd: number;
  estado: 'facturada' | 'pendiente';
  visacion: string | null;
  fecha_facturacion: string | null;
};

function fila(over: Partial<Fila> = {}): Fila {
  return {
    empresa: 'vida',
    empresa_nombre: 'Vida Digital',
    fecha_venta: '2026-11-20',
    nota: '002578',
    cliente: 'ANGELA PEREZ',
    vendedor: 'PRAVIN',
    total_usd: 1234.5,
    estado: 'facturada',
    visacion: '431033',
    fecha_facturacion: '2026-11-21',
    ...over,
  };
}

const respuestaTabla = (notas: unknown[] = []) => ({
  notas,
  vendedores: [],
  total: notas.length,
  limit: 300,
});

const esFiltros = (url: string) => url.startsWith('/api/vendedores/filtros');
const esBuscar = (url: string) => url.startsWith('/api/vendedores/buscar');
const esDetalle = (url: string) => url.startsWith('/api/vendedores/notas/');
const esTabla = (url: string) =>
  url === '/api/vendedores/notas' || url.startsWith('/api/vendedores/notas?');

/** Mock de fetch para renderizar el Buscador solo. */
function mockBuscar(resolver?: (url: string) => Promise<unknown>) {
  const fn = jest.fn((url: string) =>
    resolver
      ? resolver(String(url))
      : Promise.resolve({ ok: true, status: 200, json: async () => ({ notas: [fila()] }) })
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Mock de fetch de la pantalla completa (filtros, tabla, buscador y detalle). */
function mockApp(opts: { buscador?: (url: string) => Promise<unknown>; notas?: unknown[] } = {}) {
  const fn = jest.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (esFiltros(u)) {
      if (init?.method === 'PUT') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ filtros: null }) });
    }
    if (esBuscar(u)) {
      return (
        opts.buscador?.(u) ??
        Promise.resolve({ ok: true, status: 200, json: async () => ({ notas: [fila()] }) })
      );
    }
    if (esDetalle(u)) {
      const [, empresa, nota] = u.match(/notas\/([^/]+)\/([^/]+)$/)!;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ...fila(),
          empresa,
          nota,
          cliente_factura: 'ANGELA PEREZ SPA',
          fecha_visacion: null,
          lineas: [],
          diferencia_usd: null,
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => respuestaTabla(opts.notas ?? []),
    });
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const llamadasA = (fn: jest.Mock, pred: (url: string) => boolean) =>
  fn.mock.calls.filter((c) => pred(String(c[0])));

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('buscador: debounce y umbral', () => {
  it('3 teclas seguidas producen una sola consulta a los 250 ms', async () => {
    jest.useFakeTimers();
    const fn = mockBuscar();
    render(<BuscadorNotas puedeVerDetalle />);

    fireEvent.change(combo(), { target: { value: 'a' } });
    fireEvent.change(combo(), { target: { value: 'an' } });
    fireEvent.change(combo(), { target: { value: 'ang' } });
    expect(fn).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(249);
    });
    expect(fn).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(String(fn.mock.calls[0][0])).toBe('/api/vendedores/buscar?q=ang');
  });

  it('menos de 2 caracteres no consulta ni abre el listado', async () => {
    jest.useFakeTimers();
    const fn = mockBuscar();
    render(<BuscadorNotas puedeVerDetalle />);

    fireEvent.change(combo(), { target: { value: 'a' } });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(fn).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('buscador: resultados', () => {
  it('muestra empresa, nota, cliente, fecha, total y estado', async () => {
    jest.useFakeTimers();
    mockBuscar();
    render(<BuscadorNotas puedeVerDetalle />);

    fireEvent.change(combo(), { target: { value: 'ang' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    const opcion = screen.getByRole('option');
    expect(opcion).toHaveTextContent('002578');
    expect(opcion).toHaveTextContent('Vida Digital');
    expect(opcion).toHaveTextContent('ANGELA PEREZ');
    expect(opcion).toHaveTextContent('20-11-2026');
    expect(opcion).toHaveTextContent('$1,234.50');
    expect(opcion).toHaveTextContent('Facturada');
  });

  it('descarta la respuesta vieja que llega despues de la nueva', async () => {
    jest.useFakeTimers();
    const pendientes: Array<(valor: unknown) => void> = [];
    mockBuscar(() => new Promise((resolver) => pendientes.push(resolver)));
    render(<BuscadorNotas puedeVerDetalle />);

    fireEvent.change(combo(), { target: { value: 'an' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    fireEvent.change(combo(), { target: { value: 'ang' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(pendientes).toHaveLength(2);

    // Llega primero la de "ang" y despues la vieja de "an".
    await act(async () => {
      pendientes[1]({
        ok: true,
        status: 200,
        json: async () => ({ notas: [fila({ nota: 'ANG-222' })] }),
      });
    });
    await act(async () => {
      pendientes[0]({
        ok: true,
        status: 200,
        json: async () => ({ notas: [fila({ nota: 'AN-111' })] }),
      });
    });

    expect(screen.getByText('ANG-222')).toBeInTheDocument();
    expect(screen.queryByText('AN-111')).not.toBeInTheDocument();
  });

  it('sin resultados muestra el mensaje y no rompe el listado', async () => {
    jest.useFakeTimers();
    mockBuscar(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({ notas: [] }) })
    );
    render(<BuscadorNotas puedeVerDetalle />);

    fireEvent.change(combo(), { target: { value: 'zzz' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(screen.getByText(/Sin resultados para/)).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('un error de la consulta muestra "No se pudo buscar"', async () => {
    jest.useFakeTimers();
    mockBuscar(() => Promise.reject(new Error('boom')));
    render(<BuscadorNotas puedeVerDetalle />);

    fireEvent.change(combo(), { target: { value: 'ang' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(screen.getByText('No se pudo buscar')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});

describe('buscador: teclado y accesibilidad', () => {
  it('flechas mueven aria-activedescendant, Enter abre y Escape limpia', async () => {
    jest.useFakeTimers();
    const onVerDetalle = jest.fn();
    mockBuscar(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ notas: [fila({ nota: 'A1' }), fila({ nota: 'A2' })] }),
      })
    );
    render(<BuscadorNotas puedeVerDetalle onVerDetalle={onVerDetalle} />);

    const input = combo();
    input.focus();
    fireEvent.change(input, { target: { value: 'a1' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'buscador-nota-op-0');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'buscador-nota-op-1');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', 'buscador-nota-op-0');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onVerDetalle).toHaveBeenCalledWith('vida', 'A1');
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'a2' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(input);
  });
});

describe('buscador: modal del vendedor (sin costos)', () => {
  it('click abre solo la cabecera, sin consultas extra ni costo/ganancia/precio', async () => {
    jest.useFakeTimers();
    const fn = mockBuscar();
    render(<BuscadorNotas puedeVerDetalle={false} />);

    fireEvent.change(combo(), { target: { value: 'ang' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('option'));

    const dialogo = await screen.findByRole('dialog');
    for (const dato of [
      '002578',
      'Vida Digital',
      'ANGELA PEREZ',
      'PRAVIN',
      '20-11-2026',
      '$1,234.50',
      'Facturada',
      '431033',
      '21-11-2026',
    ]) {
      expect(dialogo).toHaveTextContent(dato);
    }
    expect(dialogo.textContent).not.toMatch(/costo|ganancia|precio/i);
    expect(fn).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('buscador: integracion con VendedoresClient', () => {
  it('flag apagado: no monta el campo ni consulta /buscar', async () => {
    const fn = mockApp({ notas: [] });
    render(<VendedoresClient />);

    await waitFor(() => expect(llamadasA(fn, esTabla)).toHaveLength(1));
    expect(screen.queryByRole('combobox', { name: NOMBRE })).not.toBeInTheDocument();
    expect(llamadasA(fn, esBuscar)).toHaveLength(0);
  });

  it('flag encendido: monta el campo', async () => {
    mockApp({ notas: [] });
    render(<VendedoresClient buscadorActivo />);

    expect(await screen.findByRole('combobox', { name: NOMBRE })).toBeInTheDocument();
  });

  it.each([
    ['vida', 'Vida Digital'],
    ['sanjh', 'SANJH'],
  ])('la misma nota en vida y sanjh abre el detalle de %s', async (empresa, nombre) => {
    jest.useFakeTimers();
    const fn = mockApp({
      buscador: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            notas: [
              fila({ empresa: 'vida', empresa_nombre: 'Vida Digital', nota: '002578' }),
              fila({ empresa: 'sanjh', empresa_nombre: 'SANJH', nota: '002578' }),
            ],
          }),
        }),
    });
    render(<VendedoresClient puedeVerDetalle buscadorActivo />);
    await waitFor(() => expect(llamadasA(fn, esTabla)).toHaveLength(1));

    fireEvent.change(combo(), { target: { value: '2578' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    const lista = screen.getByRole('listbox');
    expect(within(lista).getAllByRole('option')).toHaveLength(2);

    fireEvent.click(within(lista).getByRole('option', { name: new RegExp(nombre) }));

    expect(await screen.findByText('Detalle de nota 002578')).toBeInTheDocument();
    await waitFor(() =>
      expect(fn.mock.calls.some(([u]) => String(u) === `/api/vendedores/notas/${empresa}/002578`)).toBe(
        true
      )
    );
  });

  it('escribir no consulta /api/vendedores/notas ni guarda filtros', async () => {
    jest.useFakeTimers();
    const fn = mockApp({ notas: [fila({ nota: 'TABLA-1' })] });
    render(<VendedoresClient buscadorActivo />);
    await waitFor(() => expect(llamadasA(fn, esTabla)).toHaveLength(1));
    const antes = llamadasA(fn, esTabla).length;

    fireEvent.change(combo(), { target: { value: 'ang' } });
    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    expect(llamadasA(fn, esBuscar)).toHaveLength(1);
    expect(llamadasA(fn, esTabla)).toHaveLength(antes);
    const puts = fn.mock.calls.filter(
      ([u, init]) => esFiltros(String(u)) && (init as RequestInit | undefined)?.method === 'PUT'
    );
    expect(puts).toHaveLength(0);
  });
});

describe('buscador: hidratacion', () => {
  it('el render del servidor no trae resultados ni fechas', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToString } = require('react-dom/server') as typeof import('react-dom/server');
    const html = renderToString(<BuscadorNotas puedeVerDetalle />);

    expect(html).toContain('Buscar por N');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(html).not.toContain('role="option"');
  });
});
