/**
 * @jest-environment jsdom
 *
 * S2b — Fase B (T15/T17): comportamiento de VendedoresClient.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { TextEncoder, TextDecoder } from 'util';
import { hoyCL, lunesSemanaCL, primerDiaMesCL } from '@/lib/fechas';
import { VendedoresClient } from '@/app/(app)/vendedores/VendedoresClient';

const g = globalThis as unknown as Record<string, unknown>;
g.TextEncoder = g.TextEncoder ?? TextEncoder;
g.TextDecoder = g.TextDecoder ?? TextDecoder;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToString } = require('react-dom/server') as typeof import('react-dom/server');

type Respuesta = { notas: unknown[]; vendedores: string[]; total: number; limit: number };

function fila(nota: string, over: Record<string, unknown> = {}) {
  return {
    empresa: 'vida',
    empresa_nombre: 'Vida Digital',
    fecha_venta: '2026-11-09',
    nota,
    cliente: 'MILENKA',
    vendedor: 'PRAVIN',
    total_usd: 825,
    estado: 'facturada',
    visacion: '431033',
    fecha_facturacion: '2026-11-10',
    ...over,
  };
}

function respuesta(notas: unknown[] = [], total = notas.length): Respuesta {
  return { notas, vendedores: ['PRAVIN'], total, limit: 300 };
}

function fetchOk(r: Respuesta) {
  const fn = jest.fn(() => Promise.resolve({ ok: true, json: async () => r }));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function ultima(fn: jest.Mock) {
  return String(fn.mock.calls[fn.mock.calls.length - 1]?.[0]);
}

afterEach(cleanup);

describe('tabla', () => {
  it('carga al montar sin filtros y muestra las 9 columnas', async () => {
    const fn = fetchOk(respuesta([fila('002514')]));
    render(<VendedoresClient />);

    await screen.findByText('002514');
    expect((fn.mock.calls[0] as unknown[])[0]).toBe('/api/vendedores/notas');
    for (const h of [
      'Empresa',
      'Fecha venta',
      'Nota',
      'Cliente',
      'Vendedor',
      'Total USD',
      'Estado',
      'N° visación',
      'Facturación',
    ]) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText('VENDEDORES')).toBeInTheDocument();
  });

  it('pinta — en visacion y facturacion nulas', async () => {
    fetchOk(
      respuesta([
        fila('003817', { empresa: 'sanjh', empresa_nombre: 'SANJH', estado: 'pendiente', visacion: null, fecha_facturacion: null }),
      ])
    );
    render(<VendedoresClient />);

    const tr = (await screen.findByText('003817')).closest('tr');
    expect(within(tr as HTMLElement).getAllByText('—')).toHaveLength(2);
  });

  it('avisa cuando hay mas filas que el limite', async () => {
    fetchOk(respuesta([fila('002514')], 400));
    render(<VendedoresClient />);
    expect(await screen.findByText('Mostrando los primeros 1 de 400')).toBeInTheDocument();
  });

  it('sin datos -> mensaje de vacio', async () => {
    fetchOk(respuesta([]));
    render(<VendedoresClient />);
    expect(await screen.findByText('No hay notas para los filtros elegidos.')).toBeInTheDocument();
  });

  it('si la consulta falla -> mensaje de error', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('boom'))) as unknown as typeof fetch;
    render(<VendedoresClient />);
    expect(await screen.findByText('Error al cargar las notas.')).toBeInTheDocument();
  });
});

describe('fechas de venta', () => {
  it('limpiar las fechas deja de mandar desde/hasta', async () => {
    const fn = fetchOk(respuesta());
    render(<VendedoresClient />);
    await waitFor(() => expect(fn).toHaveBeenCalled());

    const desde = screen.getByLabelText('Fecha de venta desde') as HTMLInputElement;
    fireEvent.change(desde, { target: { value: '2026-11-01' } });
    await waitFor(() => expect(ultima(fn)).toContain('desde=2026-11-01'));

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar fechas de venta' }));
    await waitFor(() => expect(ultima(fn)).not.toContain('desde='));
    expect(ultima(fn)).not.toContain('hasta=');
    expect(desde.value).toBe('');
  });

  it('los atajos Hoy / Esta semana / Este mes escriben las fechas de Chile', async () => {
    fetchOk(respuesta());
    render(<VendedoresClient />);
    const desde = screen.getByLabelText('Fecha de venta desde') as HTMLInputElement;
    const hasta = screen.getByLabelText('Fecha de venta hasta') as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(desde.value).toBe(hoyCL());
    expect(hasta.value).toBe(hoyCL());

    fireEvent.click(screen.getByRole('button', { name: 'Esta semana' }));
    expect(desde.value).toBe(lunesSemanaCL());
    expect(hasta.value).toBe(hoyCL());

    fireEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(desde.value).toBe(primerDiaMesCL());
    expect(hasta.value).toBe(hoyCL());
  });
});

describe('visacion', () => {
  it('una fecha de visacion fuerza Facturadas, deshabilita Pendientes y se envia a la API', async () => {
    const fn = fetchOk(respuesta());
    render(<VendedoresClient />);
    await waitFor(() => expect(fn).toHaveBeenCalled());

    const visa = screen.getByLabelText('Fecha de visación desde');
    fireEvent.change(visa, { target: { value: '2026-11-01' } });

    const estado = screen.getByLabelText('Estado') as HTMLSelectElement;
    await waitFor(() => expect(estado.value).toBe('facturadas'));
    expect((screen.getByRole('option', { name: 'Pendientes' }) as HTMLOptionElement).disabled).toBe(true);

    await waitFor(() => expect(ultima(fn)).toContain('visaDesde=2026-11-01'));
    expect(ultima(fn)).toContain('estado=facturadas');

    fireEvent.change(visa, { target: { value: '' } });
    await waitFor(() =>
      expect((screen.getByRole('option', { name: 'Pendientes' }) as HTMLOptionElement).disabled).toBe(false)
    );
  });
});

describe('carrera de respuestas', () => {
  it('ignora la respuesta que llega fuera de orden', async () => {
    const pendientes: Array<(v: unknown) => void> = [];
    global.fetch = jest.fn(
      () => new Promise((resolve) => pendientes.push(resolve))
    ) as unknown as typeof fetch;

    render(<VendedoresClient />);
    await waitFor(() => expect(pendientes).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'facturadas' } });
    await waitFor(() => expect(pendientes).toHaveLength(2));

    await act(async () => {
      pendientes[1]({ ok: true, json: async () => respuesta([fila('SEGUNDA')]) });
    });
    await act(async () => {
      pendientes[0]({ ok: true, json: async () => respuesta([fila('PRIMERA')]) });
    });

    expect(screen.getByText('SEGUNDA')).toBeInTheDocument();
    expect(screen.queryByText('PRIMERA')).toBeNull();
  });
});

describe('hidratacion', () => {
  it('el primer render no calcula fechas y no rompe la hidratacion', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => respuesta() })
    ) as unknown as typeof fetch;

    const html = renderToString(<VendedoresClient />);
    expect(html).toContain('VENDEDORES');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errores: string[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errores.push(args.map((a) => String(a)).join(' '));
    });
    g.IS_REACT_ACT_ENVIRONMENT = true;
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, <VendedoresClient />);
    });
    spy.mockRestore();

    expect(errores.filter((m) => /did not match|Text content|hydrat|server-rendered/i.test(m))).toEqual([]);
    await act(async () => {
      root!.unmount();
    });
    container.remove();
  });
});
