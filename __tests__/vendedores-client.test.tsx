/**
 * @jest-environment jsdom
 *
 * S2b — Fase B (T15/T17): comportamiento de VendedoresClient.
 * S3 — Fase B: restauracion/guardado de filtros (R6), EXP-1 y EXP-3.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { TextEncoder, TextDecoder } from 'util';
import { hoyCL, lunesSemanaCL, primerDiaMesCL } from '@/lib/fechas';
import { VendedoresClient } from '@/app/(app)/vendedores/VendedoresClient';
import * as Modal from '@/app/(app)/vendedores/NotaDetalleModal';

jest.mock('@/app/(app)/vendedores/NotaDetalleModal', () => {
  const actual = jest.requireActual<typeof import('@/app/(app)/vendedores/NotaDetalleModal')>(
    '@/app/(app)/vendedores/NotaDetalleModal'
  );
  return { ...actual, NotaDetalleModal: jest.fn(actual.NotaDetalleModal) };
});

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

const esFiltros = (url: string) => url.startsWith('/api/vendedores/filtros');

/** Mock de fetch que separa GET/PUT de filtros de la consulta de notas. */
function fetchMock(opts: { guardados?: unknown; notas?: Respuesta; putOk?: boolean } = {}) {
  const fn = jest.fn((url: string, init?: RequestInit) => {
    if (esFiltros(String(url))) {
      if (init?.method === 'PUT') {
        const ok = opts.putOk !== false;
        return Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => ({ filtros: {} }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ filtros: opts.guardados ?? null }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => opts.notas ?? respuesta() });
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const notasCalls = (fn: jest.Mock) => fn.mock.calls.filter((c) => !esFiltros(String(c[0])));
const putCalls = (fn: jest.Mock) =>
  fn.mock.calls.filter(
    (c) => esFiltros(String(c[0])) && (c[1] as RequestInit | undefined)?.method === 'PUT'
  );
const ultimaNotas = (fn: jest.Mock) => String(notasCalls(fn)[notasCalls(fn).length - 1]?.[0] ?? '');

/** Monta y espera la primera consulta de notas (ya restaurados los filtros). */
async function montar(fn: jest.Mock) {
  render(<VendedoresClient />);
  await waitFor(() => expect(notasCalls(fn)).toHaveLength(1));
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(cleanup);

describe('tabla', () => {
  it('carga al montar con el mes en curso y muestra las 9 columnas', async () => {
    const fn = fetchMock({ notas: respuesta([fila('002514')]) });
    render(<VendedoresClient />);

    await screen.findByText('002514');
    expect(esFiltros(String((fn.mock.calls[0] as unknown[])[0]))).toBe(true);
    expect(ultimaNotas(fn)).toContain(`desde=${primerDiaMesCL()}`);
    expect(ultimaNotas(fn)).toContain(`hasta=${hoyCL()}`);
    expect((screen.getByLabelText('Fecha de venta desde') as HTMLInputElement).value).toBe(primerDiaMesCL());
    expect((screen.getByLabelText('Fecha de venta hasta') as HTMLInputElement).value).toBe(hoyCL());
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
    fetchMock({
      notas: respuesta([
        fila('003817', { empresa: 'sanjh', empresa_nombre: 'SANJH', estado: 'pendiente', visacion: null, fecha_facturacion: null }),
      ]),
    });
    render(<VendedoresClient />);

    const tr = (await screen.findByText('003817')).closest('tr');
    expect(within(tr as HTMLElement).getAllByText('—')).toHaveLength(2);
  });

  it('avisa cuando hay mas filas que el limite', async () => {
    fetchMock({ notas: respuesta([fila('002514')], 400) });
    render(<VendedoresClient />);
    expect(await screen.findByText('Mostrando los primeros 1 de 400')).toBeInTheDocument();
  });

  it('sin datos -> mensaje de vacio', async () => {
    fetchMock({ notas: respuesta([]) });
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
  it('limpiar sin visacion vuelve al mes en curso', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    await waitFor(() => expect(ultimaNotas(fn)).toContain(`desde=${hoyCL()}`));

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar fechas de venta' }));
    await waitFor(() => expect(ultimaNotas(fn)).toContain(`desde=${primerDiaMesCL()}`));
    expect((screen.getByLabelText('Fecha de venta desde') as HTMLInputElement).value).toBe(primerDiaMesCL());
    expect((screen.getByLabelText('Fecha de venta hasta') as HTMLInputElement).value).toBe(hoyCL());
  });

  it('vaciar ambos campos sin visacion vuelve al mes en curso', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);
    const desde = screen.getByLabelText('Fecha de venta desde') as HTMLInputElement;
    const hasta = screen.getByLabelText('Fecha de venta hasta') as HTMLInputElement;

    fireEvent.change(desde, { target: { value: '' } });
    fireEvent.change(hasta, { target: { value: '' } });

    await waitFor(() => expect(desde.value).toBe(primerDiaMesCL()));
    expect(hasta.value).toBe(hoyCL());
  });

  it('limpiar con rango de visacion deja las fechas de venta vacias', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);

    fireEvent.change(screen.getByLabelText('Fecha de visación desde'), { target: { value: '2026-11-01' } });
    await waitFor(() => expect(ultimaNotas(fn)).toContain('visaDesde=2026-11-01'));

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar fechas de venta' }));
    await waitFor(() => expect(ultimaNotas(fn)).not.toContain('desde='));
    expect(ultimaNotas(fn)).not.toContain('hasta=');
    expect((screen.getByLabelText('Fecha de venta desde') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Fecha de venta hasta') as HTMLInputElement).value).toBe('');
  });

  it('los atajos Hoy / Esta semana / Este mes escriben las fechas de Chile', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);
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
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);

    const visa = screen.getByLabelText('Fecha de visación desde');
    fireEvent.change(visa, { target: { value: '2026-11-01' } });

    const estado = screen.getByLabelText('Estado') as HTMLSelectElement;
    await waitFor(() => expect(estado.value).toBe('facturadas'));
    expect((screen.getByRole('option', { name: 'Pendientes' }) as HTMLOptionElement).disabled).toBe(true);

    await waitFor(() => expect(ultimaNotas(fn)).toContain('visaDesde=2026-11-01'));
    expect(ultimaNotas(fn)).toContain('estado=facturadas');

    fireEvent.change(visa, { target: { value: '' } });
    await waitFor(() =>
      expect((screen.getByRole('option', { name: 'Pendientes' }) as HTMLOptionElement).disabled).toBe(false)
    );
  });
});

describe('filtros guardados (R6)', () => {
  it('restaura los filtros antes de pedir notas: una sola consulta', async () => {
    const guardados = {
      vendedor: 'ANGELA',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      visaDesde: '',
      visaHasta: '',
      estado: 'facturadas',
      empresa: 'sanjh',
    };
    const fn = fetchMock({ guardados, notas: { ...respuesta(), vendedores: ['ANGELA'] } });
    render(<VendedoresClient />);

    await waitFor(() =>
      expect((screen.getByLabelText('Vendedor') as HTMLSelectElement).value).toBe('ANGELA')
    );
    expect(notasCalls(fn)).toHaveLength(1);
    const url = ultimaNotas(fn);
    expect(url).toContain('vendedor=ANGELA');
    expect(url).toContain('desde=2026-10-01');
    expect(url).toContain('hasta=2026-10-31');
    expect(url).toContain('estado=facturadas');
    expect(url).toContain('empresa=sanjh');

    await esperar(700);
    expect(notasCalls(fn)).toHaveLength(1);
    expect(putCalls(fn)).toHaveLength(0);
  });

  it('guarda con debounce: varios cambios rapidos = un solo PUT con el estado final', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);
    await screen.findByRole('option', { name: 'PRAVIN' });

    fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: 'PRAVIN' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'pendientes' } });
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'sanjh' } });

    await waitFor(() => expect(putCalls(fn)).toHaveLength(1), { timeout: 2000 });
    const body = JSON.parse(String((putCalls(fn)[0][1] as RequestInit).body));
    expect(body).toMatchObject({ vendedor: 'PRAVIN', estado: 'pendientes', empresa: 'sanjh' });

    await esperar(700);
    expect(putCalls(fn)).toHaveLength(1);
  });

  it('un fallo al guardar no rompe la pantalla y muestra un aviso discreto', async () => {
    const fn = fetchMock({ putOk: false, notas: respuesta([fila('002514')]) });
    await montar(fn);

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'facturadas' } });

    expect(await screen.findByText('No se pudieron guardar los filtros.')).toBeInTheDocument();
    expect(screen.getByText('002514')).toBeInTheDocument();
  });
});

describe('validacion de fechas en el cliente (EXP-1, EXP-3)', () => {
  it('rango de venta invertido: mensaje claro y no consulta', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);

    fireEvent.change(screen.getByLabelText('Fecha de venta desde'), { target: { value: '2026-11-10' } });
    await waitFor(() => expect(ultimaNotas(fn)).toContain('desde=2026-11-10'));
    const llamadas = notasCalls(fn).length;

    fireEvent.change(screen.getByLabelText('Fecha de venta hasta'), { target: { value: '2026-11-01' } });

    expect(await screen.findByText('La fecha desde es posterior a la fecha hasta')).toBeInTheDocument();
    await esperar(300);
    expect(notasCalls(fn)).toHaveLength(llamadas);
  });

  it('rango de visacion invertido: mensaje claro y no consulta ni guarda', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);

    fireEvent.change(screen.getByLabelText('Fecha de visación desde'), { target: { value: '2026-11-10' } });
    await waitFor(() => expect(ultimaNotas(fn)).toContain('visaDesde=2026-11-10'));
    const llamadas = notasCalls(fn).length;

    fireEvent.change(screen.getByLabelText('Fecha de visación hasta'), { target: { value: '2026-11-01' } });

    expect(
      await screen.findByText('La fecha de visación desde es posterior a la fecha de visación hasta')
    ).toBeInTheDocument();
    await esperar(700);
    expect(notasCalls(fn)).toHaveLength(llamadas);
    expect(putCalls(fn)).toHaveLength(0);
  });

  it('fecha parcial o fuera de rango (0002-11-11): no consulta ni guarda', async () => {
    const fn = fetchMock({ notas: respuesta() });
    await montar(fn);
    const llamadas = notasCalls(fn).length;

    fireEvent.change(screen.getByLabelText('Fecha de venta hasta'), { target: { value: '0002-11-11' } });

    expect(await screen.findByText('Hay una fecha incompleta o inválida.')).toBeInTheDocument();
    await esperar(700);
    expect(notasCalls(fn)).toHaveLength(llamadas);
    expect(putCalls(fn)).toHaveLength(0);
  });
});

describe('carrera de respuestas', () => {
  it('ignora la respuesta que llega fuera de orden', async () => {
    const pendientes: Array<{ url: string; resolver: (v: unknown) => void }> = [];
    global.fetch = jest.fn(
      (url: string) =>
        new Promise((resolver) => pendientes.push({ url: String(url), resolver }))
    ) as unknown as typeof fetch;

    render(<VendedoresClient />);
    await waitFor(() => expect(pendientes).toHaveLength(1));
    expect(esFiltros(pendientes[0].url)).toBe(true);
    await act(async () => {
      pendientes[0].resolver({ ok: true, json: async () => ({ filtros: null }) });
    });

    await waitFor(() => expect(pendientes).toHaveLength(2));

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'facturadas' } });
    await waitFor(() => expect(pendientes).toHaveLength(3));

    await act(async () => {
      pendientes[2].resolver({ ok: true, json: async () => respuesta([fila('SEGUNDA')]) });
    });
    await act(async () => {
      pendientes[1].resolver({ ok: true, json: async () => respuesta([fila('PRIMERA')]) });
    });

    expect(screen.getByText('SEGUNDA')).toBeInTheDocument();
    expect(screen.queryByText('PRIMERA')).toBeNull();
  });
});

describe('EXP-1: un cambio pendiente no se pierde al salir', () => {
  it('al desmontar antes del debounce envia un PUT keepalive con el ultimo estado', async () => {
    const fn = fetchMock({ notas: respuesta() });
    const { unmount } = render(<VendedoresClient />);
    await waitFor(() => expect(notasCalls(fn)).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'facturadas' } });
    unmount();

    expect(putCalls(fn)).toHaveLength(1);
    const init = putCalls(fn)[0][1] as RequestInit;
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toMatchObject({ estado: 'facturadas' });

    await esperar(700);
    expect(putCalls(fn)).toHaveLength(1);
  });

  it('sin cambios pendientes al desmontar no envia nada', async () => {
    const fn = fetchMock({ notas: respuesta() });
    const { unmount } = render(<VendedoresClient />);
    await waitFor(() => expect(notasCalls(fn)).toHaveLength(1));

    unmount();
    expect(putCalls(fn)).toHaveLength(0);
  });

  it('pagehide envia el cambio pendiente con keepalive y no lo repite', async () => {
    const fn = fetchMock({ notas: respuesta() });
    render(<VendedoresClient />);
    await waitFor(() => expect(notasCalls(fn)).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'sanjh' } });
    fireEvent(window, new Event('pagehide'));

    expect(putCalls(fn)).toHaveLength(1);
    const init = putCalls(fn)[0][1] as RequestInit;
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toMatchObject({ empresa: 'sanjh' });

    await esperar(700);
    expect(putCalls(fn)).toHaveLength(1);
  });
});

describe('fila clickeable (R7)', () => {
  const DETALLE = {
    empresa: 'vida',
    empresa_nombre: 'Vida Digital',
    nota: '002514',
    fecha_venta: '2026-11-09',
    cliente: 'MILENKA',
    cliente_factura: 'MILENKA SPA',
    vendedor: 'PRAVIN',
    total_usd: 825,
    estado: 'facturada',
    visacion: '431033',
    fecha_visacion: '2026-11-10',
    lineas: [],
    diferencia_usd: null,
  };

  function fetchConDetalle(notas: Respuesta) {
    const fn = jest.fn((url: string, init?: RequestInit) => {
      if (esFiltros(String(url))) {
        if (init?.method === 'PUT') return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ filtros: null }) });
      }
      if (String(url).startsWith('/api/vendedores/notas/')) {
        const [, empresa, nota] = String(url).match(/notas\/([^/]+)\/([^/]+)$/)!;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...DETALLE, empresa, nota }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => notas });
    });
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it('click en la fila abre el modal con empresa y nota de esa fila', async () => {
    const fn = fetchConDetalle(respuesta([fila('002514')]));
    render(<VendedoresClient />);

    fireEvent.click((await screen.findByText('002514')).closest('tr') as HTMLElement);

    expect(await screen.findByText('Detalle de nota 002514')).toBeInTheDocument();
    expect(fn.mock.calls.some((c) => String(c[0]) === '/api/vendedores/notas/vida/002514')).toBe(true);

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => expect(screen.queryByText('Detalle de nota 002514')).toBeNull());
  });

  it('la fila es accesible: tabIndex y Enter/Espacio abren el detalle', async () => {
    const fn = fetchConDetalle(
      respuesta([fila('003817', { empresa: 'sanjh', empresa_nombre: 'SANJH' })])
    );
    render(<VendedoresClient />);

    const tr = (await screen.findByText('003817')).closest('tr') as HTMLElement;
    expect(tr.tabIndex).toBe(0);

    fireEvent.keyDown(tr, { key: 'Enter' });
    await waitFor(() =>
      expect(fn.mock.calls.some((c) => String(c[0]) === '/api/vendedores/notas/sanjh/003817')).toBe(true)
    );
  });

  it('B11 smoke R4-R7: pagina 2, abre/cierra detalle, cambia tamano y filtra', async () => {
    const fn = fetchConDetalle(respuesta(lote(76)));
    render(<VendedoresClient />);
    await screen.findByText('000001');
    siguiente();
    fireEvent.click(screen.getByText('000026').closest('tr')!);
    expect(await screen.findByText('Detalle de nota 000026')).toBeInTheDocument();
    expect(fn.mock.calls.some(([url]) => url === '/api/vendedores/notas/vida/000026')).toBe(true);
    fireEvent.click(screen.getByText('Close'));
    expect(screen.getByText('Página 2 de 4')).toBeInTheDocument();
    tamano(50);
    expect(screen.getByText('Mostrando 51-76 de 76')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'sanjh' } });
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
  });
});

// S7b riesgos: limites, filtros/seleccion compartidos, carga/error, carrera e hidratacion (B14 abajo).
function lote(n: number, prefijo = '') {
  return Array.from({ length: n }, (_, i) => fila(`${prefijo}${String(i + 1).padStart(6, '0')}`));
}
const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
const tamano = (n: number) => fireEvent.change(screen.getByLabelText('Notas por página'), { target: { value: String(n) } });
const visibles = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
  .map((tr) => within(tr).getAllByRole('cell')[2].textContent);

describe('S7b paginacion y colores', () => {
  it('B1: vacio no ofrece paginas fantasma', async () => {
    fetchMock();
    render(<VendedoresClient />);
    await screen.findByText('No hay notas para los filtros elegidos.');
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 0-0 de 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it.each([25, 26, 50])('B2: %i notas sin duplicados ni pagina vacia', async (n) => {
    fetchMock({ notas: respuesta(lote(n)) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    expect(visibles()).toEqual(lote(25).map((f) => f.nota));
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    const ids = visibles();
    if (n > 25) {
      siguiente();
      expect(visibles()).toEqual(lote(n).slice(25).map((f) => f.nota));
      ids.push(...visibles());
      expect(screen.getByText(`Mostrando 26-${n} de ${n}`)).toBeInTheDocument();
    }
    expect(new Set(ids).size).toBe(n);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    siguiente();
    expect(screen.getByText(`Página ${Math.ceil(n / 25)} de ${Math.ceil(n / 25)}`)).toBeInTheDocument();
  });

  it('B3: corrige pagina alta y conserva la valida al cambiar 25/50/100', async () => {
    fetchMock({ notas: respuesta(lote(120)) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    for (let i = 0; i < 4; i++) siguiente();
    tamano(50);
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 101-120 de 120')).toBeInTheDocument();
    tamano(100);
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    tamano(25);
    expect(screen.getByText('Página 2 de 5')).toBeInTheDocument();
    expect(visibles()).toEqual(lote(50).slice(25).map((f) => f.nota));
  });

  it.each([
    ['Vendedor', 'PRAVIN'], ['Empresa', 'sanjh'], ['Estado', 'pendientes'],
    ['Fecha de venta desde', '2026-10-01'], ['Fecha de venta hasta', '2026-12-01'],
    ['Fecha de visación desde', '2026-11-01'], ['Fecha de visación hasta', '2026-11-30'],
  ])('B4: %s reinicia desde pagina 3', async (label, value) => {
    fetchMock({ notas: respuesta(lote(76)) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    siguiente(); siguiente();
    expect(screen.getByText('Página 3 de 4')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(await screen.findByText('Página 1 de 4')).toBeInTheDocument();
    expect(visibles()[0]).toBe('000001');
  });

  it('B4: fecha invalida oculta controles y volver al mismo filtro reinicia pagina', async () => {
    const fn = fetchMock({ notas: respuesta(lote(76)) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    siguiente(); siguiente();
    const input = screen.getByLabelText('Fecha de venta hasta') as HTMLInputElement;
    const anterior = input.value;
    fireEvent.change(input, { target: { value: '0002-11-11' } });
    expect(screen.getByText('Hay una fecha incompleta o inválida.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación de notas' })).toBeNull();
    expect(notasCalls(fn)).toHaveLength(1);
    fireEvent.change(input, { target: { value: anterior } });
    expect(await screen.findByText('Página 1 de 4')).toBeInTheDocument();
  });

  it('B5/B6: respuesta aceptada reemplaza notas; obsoleta no cambia pagina ni datos', async () => {
    const pendientes: Array<(value: unknown) => void> = [];
    global.fetch = jest.fn((url: string) => esFiltros(url)
      ? Promise.resolve({ ok: true, json: async () => ({ filtros: null }) })
      : new Promise((resolve) => pendientes.push(resolve))) as unknown as typeof fetch;
    render(<VendedoresClient />);
    await waitFor(() => expect(pendientes).toHaveLength(1));
    await act(async () => pendientes[0]({ ok: true, json: async () => respuesta(lote(76)) }));
    siguiente(); siguiente();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'pendientes' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'facturadas' } });
    await act(async () => pendientes[2]({ ok: true, json: async () => respuesta(lote(76, 'N')) }));
    expect(screen.getByText('Página 1 de 4')).toBeInTheDocument();
    expect(visibles()[0]).toBe('N000001');
    siguiente();
    await act(async () => pendientes[1]({ ok: true, json: async () => respuesta(lote(76, 'V')) }));
    expect(screen.getByText('Página 2 de 4')).toBeInTheDocument();
    expect(visibles()).toEqual(lote(50, 'N').slice(25).map((f) => f.nota));
  });

  it('B7/B8: fallback y colores exclusivamente en el texto de Estado', async () => {
    fetchMock({ notas: respuesta([fila('1'), fila('2', { estado: 'pendiente' }), fila('3', { estado: 'raro' })]) });
    render(<VendedoresClient />);
    await screen.findByText('1');
    for (const tr of screen.getAllByRole('row').slice(1)) {
      const cells = within(tr).getAllByRole('cell');
      const facturada = cells[2].textContent === '1';
      const texto = within(cells[6]).getByText(facturada ? 'Facturada' : 'Pendiente');
      expect(texto.tagName).toBe('SPAN');
      expect(texto).toHaveClass('font-medium', facturada ? 'text-green-600' : 'text-red-600', facturada ? 'dark:text-green-400' : 'dark:text-red-400');
      for (const element of [tr, ...cells]) expect(element.className).not.toMatch(/text-(green|red)-/);
    }
  });

  it('B9: visacion conserva aviso y restriccion al paginar', async () => {
    fetchMock({ notas: respuesta(lote(76)) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    siguiente(); siguiente();
    fireEvent.change(screen.getByLabelText('Fecha de visación desde'), { target: { value: '2026-11-01' } });
    await screen.findByText('Página 1 de 4');
    siguiente();
    expect(screen.getByText('Con rango de visación solo se muestran notas facturadas.')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toHaveValue('facturadas');
    expect(screen.getByRole('option', { name: 'Pendientes' })).toBeDisabled();
  });

  it('B10: total remoto no crea paginas sin datos', async () => {
    fetchMock({ notas: respuesta(lote(300), 800) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    tamano(100); siguiente(); siguiente();
    expect(screen.getByText('Mostrando los primeros 300 de 800')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 201-300 de 300')).toBeInTheDocument();
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('B11: paginar no limpia la seleccion del modal (doble)', async () => {
    const doble = jest.mocked(Modal.NotaDetalleModal).mockImplementation(({ empresa, nota, onClose }) =>
      <div role="dialog" aria-label={`${empresa}/${nota}`}><button onClick={onClose}>Cerrar doble</button></div>);
    try {
      fetchMock({ notas: respuesta(lote(76)) });
      render(<VendedoresClient />);
      await screen.findByText('000001');
      siguiente();
      fireEvent.click(screen.getByText('000026').closest('tr')!);
      siguiente(); tamano(50);
      expect(screen.getByRole('dialog', { name: 'vida/000026' })).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cerrar doble'));
      expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    } finally {
      doble.mockImplementation(jest.requireActual<typeof Modal>('@/app/(app)/vendedores/NotaDetalleModal').NotaDetalleModal);
    }
  });

  it('B12: paginar/cambiar tamano no consulta ni persiste preferencias', async () => {
    const fn = fetchMock({ notas: respuesta(lote(120)) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    siguiente(); tamano(50); tamano(100);
    await act(async () => { await esperar(600); });
    expect(notasCalls(fn)).toHaveLength(1);
    expect(putCalls(fn)).toHaveLength(0);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('B13: carga y error no dejan controles operativos', async () => {
    const fn = fetchMock({ notas: respuesta(lote(76)) });
    render(<VendedoresClient />);
    await screen.findByText('000001');
    siguiente();
    let resolver!: (value: { ok: boolean; status: number; json: () => Promise<Respuesta> }) => void;
    fn.mockImplementationOnce(() => new Promise<{ ok: boolean; status: number; json: () => Promise<Respuesta> }>((resolve) => { resolver = resolve; }));
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'sanjh' } });
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación de notas' })).toBeNull();
    await act(async () => resolver({ ok: false, status: 500, json: async () => respuesta() }));
    expect(screen.getByText('Error al cargar las notas.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Notas por página')).toBeNull();
  });
});

describe('hidratacion', () => {
  it('el primer render no calcula fechas y no rompe la hidratacion', async () => {
    fetchMock();

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
