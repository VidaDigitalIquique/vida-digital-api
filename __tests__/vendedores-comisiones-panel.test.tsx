/**
 * @jest-environment jsdom
 *
 * S5b — Fase B: panel de COMISIONES (R8, R9). La UI no recalcula: muestra la API.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { redondearCentavos, type InformeComisiones } from '@/lib/comisiones-utils';
import { ComisionesPanel } from '@/app/(app)/vendedores/ComisionesPanel';

const INFORME_11: InformeComisiones = {
  mes: '2026-11',
  mes_etiqueta: 'noviembre 2026',
  comision_pct: 0.5,
  filas: [
    { vendedor: 'ANGELA', notas: 15, total_usd: 10980.1, comision_pct: 0.5, comision_usd: 54.9 },
    { vendedor: 'ANIL CHANDNANI', notas: 0, total_usd: 0, comision_pct: 0.5, comision_usd: 0 },
  ],
  totales: { notas: 15, total_usd: 10980.1, comision_usd: 54.9 },
};

const INFORME_10: InformeComisiones = {
  mes: '2026-10',
  mes_etiqueta: 'octubre 2026',
  comision_pct: 0.5,
  filas: [
    { vendedor: 'ANGELA', notas: 39, total_usd: 65140, comision_pct: 0.5, comision_usd: 325.7 },
    { vendedor: 'ANIL CHANDNANI', notas: 1, total_usd: 1012.5, comision_pct: 0.5, comision_usd: 5.06 },
  ],
  totales: { notas: 40, total_usd: 66152.5, comision_usd: 330.76 },
};

function informeCon(mes: string, pct: number): InformeComisiones {
  const base = mes === '2026-10' ? INFORME_10 : INFORME_11;
  const filas = base.filas.map((f) => ({
    ...f,
    comision_pct: pct,
    comision_usd: redondearCentavos((f.total_usd * pct) / 100),
  }));
  return {
    ...base,
    comision_pct: pct,
    filas,
    totales: {
      notas: filas.reduce((s, f) => s + f.notas, 0),
      total_usd: filas.reduce((s, f) => s + f.total_usd, 0),
      comision_usd: redondearCentavos(filas.reduce((s, f) => s + f.comision_usd, 0)),
    },
  };
}

function fetchMock(opts: { getOk?: boolean; putOk?: boolean } = {}) {
  const fn = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (opts.putOk === false) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      const body = JSON.parse(String(init.body)) as { mes: string; comision_pct: number };
      return Promise.resolve({ ok: true, status: 200, json: async () => informeCon(body.mes, body.comision_pct) });
    }
    if (opts.getOk === false) {
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    }
    const mes = new URL(String(url), 'http://x').searchParams.get('mes');
    return Promise.resolve({ ok: true, status: 200, json: async () => (mes === '2026-10' ? INFORME_10 : INFORME_11) });
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const puts = (fn: jest.Mock) =>
  fn.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');

const inputMes = () => screen.getByLabelText('Mes') as HTMLInputElement;
const inputPct = () => screen.getByLabelText('% de comisión') as HTMLInputElement;
const boton = () => screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;

async function montar(opts: { getOk?: boolean; putOk?: boolean } = {}) {
  const fn = fetchMock(opts);
  render(<ComisionesPanel />);
  if (opts.getOk !== false) await screen.findByText('ANGELA');
  else await screen.findByText(/No se pudieron cargar/);
  return fn;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('carga del informe', () => {
  it('pide el informe sin mes (el servidor decide el mes en curso) y muestra lo que devuelve', async () => {
    const fn = await montar();
    expect(fn.mock.calls[0][0]).toBe('/api/vendedores/comisiones');
    expect(screen.getByRole('heading', { name: 'Comisiones' })).toBeInTheDocument();
    expect(screen.getByText(/noviembre 2026/)).toBeInTheDocument();
    expect(inputMes().value).toBe('2026-11');
    expect(inputPct().value).toBe('0.50');
    expect(screen.getByText('ANIL CHANDNANI')).toBeInTheDocument();
    expect(screen.getAllByText('$10,980.10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$54.90').length).toBeGreaterThan(0);
    expect(boton().disabled).toBe(false);
  });

  it('cambia el mes y muestra el informe de ese mes', async () => {
    const fn = await montar();
    fireEvent.change(inputMes(), { target: { value: '2026-10' } });
    expect(await screen.findByText(/octubre 2026/)).toBeInTheDocument();
    expect(fn.mock.calls.some((c) => String(c[0]).includes('mes=2026-10'))).toBe(true);
    expect(screen.getByText('$1,012.50')).toBeInTheDocument();
  });

  it('si la carga falla muestra un error y no deja la tabla a medias', async () => {
    await montar({ getOk: false });
    expect(screen.queryByText('ANGELA')).not.toBeInTheDocument();
  });
});

describe('EXP-A: el % escrito no se pierde al cambiar de mes', () => {
  it('cambiar de mes con un % sin guardar conserva lo que el usuario escribio', async () => {
    await montar();
    fireEvent.change(inputPct(), { target: { value: '1' } });
    fireEvent.change(inputMes(), { target: { value: '2026-10' } });
    expect(await screen.findByText(/octubre 2026/)).toBeInTheDocument();
    expect(inputPct().value).toBe('1');
  });

  it('tras guardar, el campo vuelve a seguir al valor del servidor al cambiar de mes', async () => {
    const fn = await montar();
    fireEvent.change(inputPct(), { target: { value: '1' } });
    fireEvent.click(boton());
    await waitFor(() => expect(puts(fn)).toHaveLength(1));
    fireEvent.change(inputMes(), { target: { value: '2026-10' } });
    expect(await screen.findByText(/octubre 2026/)).toBeInTheDocument();
    expect(inputPct().value).toBe('0.50');
  });
});

describe('exportar el informe a Excel (R10)', () => {
  it('el enlace Exportar descarga el mes que se esta mirando', async () => {
    await montar();
    expect(screen.getByRole('link', { name: 'Exportar' })).toHaveAttribute(
      'href',
      '/api/vendedores/comisiones?mes=2026-11&formato=xlsx'
    );
  });

  it('al cambiar de mes el enlace apunta al mes nuevo', async () => {
    await montar();
    fireEvent.change(inputMes(), { target: { value: '2026-10' } });
    expect(await screen.findByText(/octubre 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exportar' })).toHaveAttribute(
      'href',
      '/api/vendedores/comisiones?mes=2026-10&formato=xlsx'
    );
  });
});

describe('guardar el % (R9)', () => {
  it('manda {mes, comision_pct} y pinta el informe recalculado que devuelve la API', async () => {
    const fn = await montar();
    fireEvent.change(inputPct(), { target: { value: '1' } });
    fireEvent.click(boton());

    await waitFor(() => expect(puts(fn)).toHaveLength(1));
    const body = JSON.parse(String((puts(fn)[0][1] as RequestInit).body));
    expect(body).toEqual({ mes: '2026-11', comision_pct: 1 });

    expect((await screen.findAllByText('$109.80')).length).toBeGreaterThan(0);
    expect(inputPct().value).toBe('1.00');
  });

  it('acepta coma decimal en el campo y la manda como numero', async () => {
    const fn = await montar();
    fireEvent.change(inputPct(), { target: { value: '1,5' } });
    fireEvent.click(boton());
    await waitFor(() => expect(puts(fn)).toHaveLength(1));
    const body = JSON.parse(String((puts(fn)[0][1] as RequestInit).body));
    expect(body.comision_pct).toBe(1.5);
  });

  it.each(['-1', '101', '0,555', 'abc', ''])('%p invalido: error visible, Guardar deshabilitado y sin PUT', async (valor) => {
    const fn = await montar();
    fireEvent.change(inputPct(), { target: { value: valor } });
    expect(screen.getByText(/Porcentaje inválido|Ingresa el porcentaje/)).toBeInTheDocument();
    expect(boton().disabled).toBe(true);
    fireEvent.click(boton());
    expect(puts(fn)).toHaveLength(0);
  });

  it('doble clic en Guardar hace un solo PUT', async () => {
    const fn = await montar();
    fireEvent.change(inputPct(), { target: { value: '1' } });
    fireEvent.click(boton());
    fireEvent.click(boton());
    await waitFor(() => expect(puts(fn)).toHaveLength(1));
    await screen.findAllByText('$109.80');
    expect(puts(fn)).toHaveLength(1);
  });

  it('si guardar falla avisa y deja reintentar', async () => {
    await montar({ putOk: false });
    fireEvent.change(inputPct(), { target: { value: '1' } });
    fireEvent.click(boton());
    expect(await screen.findByText(/No se pudo guardar el porcentaje/)).toBeInTheDocument();
    expect(boton().disabled).toBe(false);
  });
});
