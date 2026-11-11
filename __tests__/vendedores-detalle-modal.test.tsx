/**
 * @jest-environment jsdom
 *
 * S4b — Fase B: modal con el detalle de una nota (R7).
 * Estado inicial: ROJO (app/(app)/vendedores/NotaDetalleModal.tsx no existe).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotaDetalleModal } from '@/app/(app)/vendedores/NotaDetalleModal';
import type { DetalleNota } from '@/lib/vendedores-detalle';

const DETALLE: DetalleNota = {
  empresa: 'vida',
  empresa_nombre: 'Vida Digital',
  nota: '002499',
  fecha_venta: '2026-11-09',
  cliente: 'JOHN HUARACHI',
  cliente_factura: 'IMPORT EXPORT ADEEL SPA',
  vendedor: 'PRAVIN',
  total_usd: 2550,
  estado: 'facturada',
  visacion: '431033',
  fecha_visacion: '2026-11-10',
  lineas: [
    { codigo: 'HS-30', costo: 100, precio: 150, cajas: 2, unidades: 17, total_linea: 2550, imagen_url: null },
    { codigo: '303', costo: 10, precio: 20, cajas: 1, unidades: 9.075, total_linea: 181.5, imagen_url: null },
  ],
  diferencia_usd: 181.5,
};

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

function montar(detalle: DetalleNota = DETALLE) {
  const fn = jest.fn(() => ok(detalle));
  global.fetch = fn as unknown as typeof fetch;
  const onClose = jest.fn();
  render(<NotaDetalleModal empresa="vida" nota="002499" onClose={onClose} />);
  return { fn, onClose };
}

afterEach(cleanup);

describe('cabecera y tabla', () => {
  it('consulta la API de detalle y muestra los datos de la nota', async () => {
    const { fn } = montar({ ...DETALLE, lineas: [{ ...DETALLE.lineas[0], imagen_url: null }] });

    expect(await screen.findByText('Detalle de nota 002499')).toBeInTheDocument();
    expect(fn).toHaveBeenCalledWith('/api/vendedores/notas/vida/002499');
    expect(await screen.findByText('Vida Digital')).toBeInTheDocument();

    for (const valor of [
      'Vida Digital',
      'JOHN HUARACHI',
      'IMPORT EXPORT ADEEL SPA',
      'PRAVIN',
      '09-11-2026',
      'Facturada',
      '431033',
      '10-11-2026',
      '$2,550.00',
    ]) {
      expect(screen.getByText(valor)).toBeInTheDocument();
    }
    for (const etiqueta of [
      'Empresa',
      'Nota',
      'Cliente comprador',
      'Cliente factura',
      'Vendedor',
      'Fecha de venta',
      'Estado',
      'Visación',
      'Fecha de visación',
      'Total real',
    ]) {
      expect(screen.getByText(etiqueta)).toBeInTheDocument();
    }
  });

  it('pinta las 7 columnas, las lineas y el total de ganancia', async () => {
    montar();
    await screen.findByText('Detalle de nota 002499');
    expect(await screen.findByText('Total ganancia: $940.75')).toBeInTheDocument();

    for (const h of [
      'IMAGEN',
      'CÓDIGO',
      'COSTO',
      '% SOBRE EL COSTO',
      'CANTIDAD (cajas)',
      'PRECIO DE VENTA',
      'GANANCIA USD',
    ]) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }

    expect(screen.getAllByText('HS-30').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('303').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 cajas')).toBeInTheDocument();
    expect(screen.getByText('17 u')).toBeInTheDocument();
    expect(screen.getByText('9.075 u')).toBeInTheDocument();
    // (150-100)*17 + (20-10)*9.075 = 940.75
  });

  it('la tabla de lineas tiene scroll horizontal propio para movil', async () => {
    montar();
    await screen.findByText('Vida Digital');

    const contenedor = screen.getByRole('table').parentElement as HTMLElement;
    expect(contenedor).toHaveClass('overflow-x-auto');
    expect(contenedor).toHaveClass('min-w-0');
  });

  it('costo 0 o invalido: porcentaje "—" y nunca NaN/Infinity', async () => {
    const { fn } = montar({
      ...DETALLE,
      diferencia_usd: null,
      lineas: [{ codigo: 'ZERO', costo: 0, precio: 10, cajas: 1, unidades: 1, total_linea: 10, imagen_url: null }],
    });
    await screen.findByText('Detalle de nota 002499');

    const tr = (await screen.findAllByText('ZERO'))[0].closest('tr') as HTMLElement;
    expect(tr.textContent).toContain('—');
    expect(tr.textContent).not.toMatch(/NaN|Infinity/);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('aviso de diferencia (D13/D14)', () => {
  it('con diferencia muestra el texto exacto del PRD y la diferencia en USD', async () => {
    montar();
    expect(
      await screen.findByText(
        'Esta nota tiene líneas en el sistema que no suman al total de WinFac (diferencia USD $181.50): la ganancia por línea puede incluir productos que no son parte de la venta'
      )
    ).toBeInTheDocument();
  });

  it('sin diferencia (null) no muestra el aviso', async () => {
    montar({ ...DETALLE, diferencia_usd: null });
    await screen.findByText('Vida Digital');
    expect(screen.queryByText(/diferencia USD/)).toBeNull();
  });
});

describe('imagenes', () => {
  it('solo pide imagen cuando hay imagen_url: sin URL no toca Cloudinary', async () => {
    montar({
      ...DETALLE,
      diferencia_usd: null,
      lineas: [
        { codigo: 'CONIMG', costo: 1, precio: 2, cajas: 1, unidades: 1, total_linea: 2, imagen_url: 'https://res.cloudinary.com/demo/image/upload/a.jpg' },
        { codigo: 'SINIMG', costo: 1, precio: 2, cajas: 1, unidades: 1, total_linea: 2, imagen_url: null },
      ],
    });
    await screen.findByText('Vida Digital');

    const imgs = Array.from(document.querySelectorAll('img'));
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toContain('a.jpg');
    expect(imgs.some((i) => i.getAttribute('src')?.includes('SINIMG'))).toBe(false);
    // el codigo sin imagen se ve igual (placeholder con el codigo)
    expect(screen.getAllByText('SINIMG').length).toBeGreaterThanOrEqual(2);
  });
});

describe('estados y carreras', () => {
  it('muestra Cargando mientras espera, y Error si la API falla', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    render(<NotaDetalleModal empresa="vida" nota="002499" onClose={() => {}} />);

    expect(screen.getByText('Cargando detalle...')).toBeInTheDocument();
    expect(await screen.findByText('Error al cargar el detalle de la nota.')).toBeInTheDocument();
  });

  it('el boton de cerrar llama a onClose', async () => {
    const { onClose, fn } = montar();
    await screen.findByText('Detalle de nota 002499');
    expect(fn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('descarta la respuesta vieja al cambiar de nota', async () => {
    const pendientes: Array<{ url: string; resolver: (v: unknown) => void }> = [];
    global.fetch = jest.fn(
      (url: string) => new Promise((resolver) => pendientes.push({ url: String(url), resolver }))
    ) as unknown as typeof fetch;

    const { rerender } = render(<NotaDetalleModal empresa="vida" nota="111" onClose={() => {}} />);
    await waitFor(() => expect(pendientes).toHaveLength(1));
    expect(pendientes[0].url).toBe('/api/vendedores/notas/vida/111');

    rerender(<NotaDetalleModal empresa="vida" nota="222" onClose={() => {}} />);
    await waitFor(() => expect(pendientes).toHaveLength(2));
    expect(pendientes[1].url).toBe('/api/vendedores/notas/vida/222');

    await act(async () => {
      pendientes[1].resolver({ ok: true, json: async () => ({ ...DETALLE, nota: '222', cliente: 'SEGUNDA' }) });
    });
    await act(async () => {
      pendientes[0].resolver({ ok: true, json: async () => ({ ...DETALLE, nota: '111', cliente: 'PRIMERA' }) });
    });

    expect(screen.getByText('SEGUNDA')).toBeInTheDocument();
    expect(screen.queryByText('PRIMERA')).toBeNull();
  });
});
