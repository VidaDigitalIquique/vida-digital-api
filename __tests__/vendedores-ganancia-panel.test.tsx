/**
 * @jest-environment jsdom
 *
 * S7c-2 — Fase B: panel GANANCIA POR PERIODO (R4–R7, R11).
 * La UI no recalcula: pinta las filas y totales que devuelve la API.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { InformeGanancia } from '@/lib/vendedores-ganancia-tipos';
import { GananciaPeriodoPanel } from '@/app/(app)/vendedores/GananciaPeriodoPanel';

const DIA: InformeGanancia = {
  agrupacion: 'dia',
  desde: '2026-11-01',
  hasta: '2026-11-24',
  estado: 'todas',
  filas: [
    { periodo: '2026-11-24', etiqueta: '24-11-2026', vida_usd: 100.5, sanjh_usd: 20.25, total_usd: 120.75 },
    { periodo: '2026-11-23', etiqueta: '23-11-2026', vida_usd: 40, sanjh_usd: 0, total_usd: 40 },
  ],
  totales: { vida_usd: 140.5, sanjh_usd: 20.25, total_usd: 160.75 },
  truncado: false,
};

const SEMANA: InformeGanancia = {
  agrupacion: 'semana',
  desde: '2026-01-01',
  hasta: '2026-11-24',
  estado: 'todas',
  filas: [
    { periodo: '2026-11-23', etiqueta: 'Sem. 23-11-2026 (lun)', vida_usd: 500, sanjh_usd: 50, total_usd: 550 },
  ],
  totales: { vida_usd: 500, sanjh_usd: 50, total_usd: 550 },
  truncado: false,
};

const params = (url: unknown) => new URL(String(url), 'http://x').searchParams;
const num = (texto: string) => Number(texto.replace(/[^0-9.-]/g, ''));
const celda = (etiqueta: string) => screen.getByText(etiqueta).closest('tr') as HTMLTableRowElement;

function fetchMock(respuesta: InformeGanancia | (() => Promise<unknown>) = DIA) {
  const fn = jest.fn((url: string) => {
    void url; // el mock responde igual para cualquier URL
    return typeof respuesta === 'function'
      ? respuesta()
      : Promise.resolve({ ok: true, status: 200, json: async () => respuesta });
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

async function montar(respuesta?: InformeGanancia) {
  const fn = fetchMock(respuesta ?? DIA);
  render(<GananciaPeriodoPanel />);
  await screen.findByText('24-11-2026');
  return fn;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('flujo principal (QA-S7c-01)', () => {
  it('pide el informe sin parametros, rellena los controles y pinta filas, total y pie', async () => {
    const fn = await montar();

    expect(fn.mock.calls[0][0]).toBe('/api/vendedores/ganancia');

    expect(screen.getByRole('heading', { name: 'Ganancia por periodo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Día' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-11-24');
    expect(screen.getByLabelText('Estado')).toHaveValue('todas');

    expect(screen.getByText('Vida Digital USD')).toBeInTheDocument();
    expect(screen.getByText('SANJH USD')).toBeInTheDocument();
    expect(screen.getByText('Total USD')).toBeInTheDocument();
    expect(screen.getByText('23-11-2026')).toBeInTheDocument();
    expect(screen.getAllByText('$160.75').length).toBeGreaterThan(0);
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getAllByText('$140.50').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$20.25').length).toBeGreaterThan(0);
  });
});

describe('controles', () => {
  it('cambiar de agrupacion pide solo ?agrupar=semana y pinta las etiquetas de semana', async () => {
    const fn = await montar();
    global.fetch = jest.fn((url: string) => {
      void url;
      return Promise.resolve({ ok: true, status: 200, json: async () => SEMANA });
    }) as unknown as typeof fetch;

    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));

    expect(await screen.findByText('Sem. 23-11-2026 (lun)')).toBeInTheDocument();
    const ultima = params((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(ultima.get('agrupar')).toBe('semana');
    expect(ultima.has('desde')).toBe(false);
    expect(ultima.has('hasta')).toBe(false);
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cambiar estado o fecha manda los 5 parametros actuales', async () => {
    const fn = await montar();

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'facturadas' } });
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    let p = params(fn.mock.calls[1][0]);
    expect(p.get('agrupar')).toBe('dia');
    expect(p.get('desde')).toBe('2026-11-01');
    expect(p.get('hasta')).toBe('2026-11-24');
    expect(p.get('estado')).toBe('facturadas');

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-05' } });
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(3));
    p = params(fn.mock.calls[2][0]);
    expect(p.get('desde')).toBe('2026-11-05');
    expect(p.get('hasta')).toBe('2026-11-24');
    expect(p.get('estado')).toBe('facturadas');
  });
});

describe('estados de la carga', () => {
  it('periodo sin ventas: aviso y sin tabla', async () => {
    fetchMock({ ...DIA, filas: [], totales: { vida_usd: 0, sanjh_usd: 0, total_usd: 0 } });
    render(<GananciaPeriodoPanel />);
    expect(await screen.findByText('No hay ventas en el periodo.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('error HTTP: mensaje y sin tabla', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
    ) as unknown as typeof fetch;
    render(<GananciaPeriodoPanel />);
    expect(await screen.findByText('No se pudo cargar la ganancia.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('respuesta vieja no pisa a la nueva (race condition)', async () => {
    let resolverVieja: (v: unknown) => void = () => {};
    const vieja = new Promise((resolve) => { resolverVieja = resolve; });
    const fn = jest.fn((url: string) =>
      params(url).has('agrupar') ? Promise.resolve({ ok: true, status: 200, json: async () => SEMANA }) : vieja
    );
    global.fetch = fn as unknown as typeof fetch;
    render(<GananciaPeriodoPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByText('Sem. 23-11-2026 (lun)')).toBeInTheDocument();

    resolverVieja({ ok: true, status: 200, json: async () => DIA });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText('24-11-2026')).not.toBeInTheDocument();
    expect(screen.getByText('Sem. 23-11-2026 (lun)')).toBeInTheDocument();
  });
});

describe('cuadre de montos (R4)', () => {
  it('Vida + SANJH = Total en cada fila y en el pie, tal como llega', async () => {
    await montar();

    for (const etiqueta of ['24-11-2026', '23-11-2026']) {
      const [vida, sanjh, total] = Array.from(celda(etiqueta).cells).slice(1).map((c) => num(c.textContent ?? ''));
      expect(vida + sanjh).toBeCloseTo(total, 2);
    }

    const pie = screen.getByText('TOTAL').closest('tr') as HTMLTableRowElement;
    const [vida, sanjh, total] = Array.from(pie.cells).slice(1).map((c) => num(c.textContent ?? ''));
    expect(vida + sanjh).toBeCloseTo(total, 2);
  });

  it('el aviso de tope aparece solo si truncado', async () => {
    const fn = fetchMock({ ...DIA, truncado: true });
    render(<GananciaPeriodoPanel />);
    expect(await screen.findByText(/Se muestran los últimos 400 periodos; acota el rango\./)).toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
