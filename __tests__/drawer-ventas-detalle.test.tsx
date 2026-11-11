import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProductDrawer } from '@/components/ProductDrawer';
import flags from '@/config/feature-flags.json';
import { Producto, UserSession } from '@/types';

jest.mock('@/config/feature-flags.json', () => ({ 'drawer-ventas-detalle': true }));

const FLAG = flags as any;

const PRODUCTO: Producto = {
  id: 1,
  empresa_id: 2,
  codigo: 'HL-81',
  detalle: 'Producto de prueba',
  prcventa: 100,
  prcminimo: 80,
  costo: 50,
  cif: 40,
  saldo: 10,
  umed: 'UND',
  cantcaja: 1,
  pesocaja: 1,
  cubicaja: 1,
  nroingreso: '2024-001',
  es_nuevo: false,
  categoria: null,
  imagen_url: null,
  fecha_ingreso: new Date(),
  updated_at: new Date(),
};

const PRODUCTO_B: Producto = { ...PRODUCTO, id: 2, codigo: 'HS-30' };

const SESSION: UserSession = { id: '1', rut: '1-1', nombre: 'Admin', rol: 'admin', empresas: [2] };

const KARDEX = {
  precio_minimo: 10,
  precio_maximo: 30,
  precio_medio: 20,
  precio_medio_status: 'ok',
  total_ventas: 3,
  clientes_excluidos: 0,
};

const VENTAS = {
  ventas: [
    { fecha: '2026-11-10', nota: '002515', cliente: 'CLIENTE A', vendedor: 'PRAVIN', cajas: 1, unidades: 120, precio: 12.5 },
    { fecha: '2026-11-09', nota: '002514', cliente: 'CLIENTE B', vendedor: null, cajas: 0, unidades: 5, precio: 20 },
    { fecha: '2026-11-01', nota: '002500', cliente: null, vendedor: '', cajas: 2, unidades: 60, precio: 30 },
  ],
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

let kardexPayload: any;
let detalleRespuesta: any; // { ok, json } o promesa diferida
let fetchMock: jest.Mock;

function esVentas(url: string) {
  return url.includes('/api/kardex/ventas');
}

function llamadasVentas() {
  return fetchMock.mock.calls.filter(c => esVentas(String(c[0])));
}

beforeEach(() => {
  FLAG['drawer-ventas-detalle'] = true;
  kardexPayload = KARDEX;
  detalleRespuesta = { ok: true, json: async () => VENTAS };
  fetchMock = jest.fn((url: string) => {
    if (esVentas(url)) return Promise.resolve(detalleRespuesta);
    if (url.startsWith('/api/kardex?')) return Promise.resolve({ ok: true, json: async () => kardexPayload });
    if (url.startsWith('/api/productos/ingresos')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  global.fetch = fetchMock as any;
});

function renderDrawer(producto: Producto = PRODUCTO) {
  return render(
    <ProductDrawer
      producto={producto}
      empresaNombre="IMPORT EXPORT VIDA DIGITAL LTDA."
      session={SESSION}
      open={true}
      onOpenChange={() => {}}
      onUpdated={() => {}}
    />
  );
}

async function botonVentas() {
  return screen.findByRole('button', { name: /3 ventas registradas/i });
}

describe('ProductDrawer — detalle de ventas registradas', () => {
  it('flag apagado: texto no clickeable y cero llamadas a la API nueva', async () => {
    FLAG['drawer-ventas-detalle'] = false;
    renderDrawer();
    const texto = await screen.findByText('3 ventas registradas');
    expect(texto.tagName).toBe('DIV');
    expect(screen.queryByRole('button', { name: /ventas registradas/i })).not.toBeInTheDocument();
    expect(llamadasVentas()).toHaveLength(0);
  });

  it('flag encendido con 0 ventas: no hay boton', async () => {
    kardexPayload = { ...KARDEX, total_ventas: 0 };
    renderDrawer();
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).startsWith('/api/kardex?'))).toBe(true));
    expect(screen.queryByRole('button', { name: /ventas registradas/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/ventas registradas/)).not.toBeInTheDocument();
  });

  it('carga perezosa: pide las filas solo al hacer clic y las muestra formateadas', async () => {
    renderDrawer();
    const boton = await botonVentas();
    expect(llamadasVentas()).toHaveLength(0);
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(boton);

    expect(llamadasVentas()).toHaveLength(1);
    expect(String(llamadasVentas()[0][0])).toContain('codigo=HL-81');
    expect(String(llamadasVentas()[0][0])).toContain('empresaSlug=vidadigital');

    expect(await screen.findByText('CLIENTE A')).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    // fecha reordenada sin Date, nota, vendedor y cantidades sin decimales
    expect(screen.getByText(/10-11-2026 · Nota 002515 · PRAVIN · 1 cj · 120 uds/)).toBeInTheDocument();
    // cajas 0: no muestra "0 cj"; vendedor null -> —
    expect(screen.getByText(/09-11-2026 · Nota 002514 · — · 5 uds/)).toBeInTheDocument();
    // cliente null -> —
    expect(screen.getByText(/— · 2 cj · 60 uds/)).toBeInTheDocument();
    expect(boton).toHaveAttribute('aria-expanded', 'true');
  });

  it('segundo clic durante la carga no duplica el fetch; al cargar, colapsa', async () => {
    const d = deferred<any>();
    detalleRespuesta = d.promise;
    renderDrawer();
    const boton = await botonVentas();

    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(llamadasVentas()).toHaveLength(1);

    await act(async () => { d.resolve({ ok: true, json: async () => VENTAS }); });
    expect(await screen.findByText('CLIENTE A')).toBeInTheDocument();

    fireEvent.click(boton);
    expect(screen.queryByText('CLIENTE A')).not.toBeInTheDocument();
    expect(llamadasVentas()).toHaveLength(1);
  });

  it('estado de error sin romper el drawer', async () => {
    detalleRespuesta = { ok: false, json: async () => ({ error: 'boom' }) };
    renderDrawer();
    fireEvent.click(await botonVentas());
    expect(await screen.findByText('No se pudieron cargar las ventas.')).toBeInTheDocument();
  });

  it('respuesta vacia: muestra el estado vacio', async () => {
    detalleRespuesta = { ok: true, json: async () => ({ ventas: [] }) };
    renderDrawer();
    fireEvent.click(await botonVentas());
    expect(await screen.findByText('No hay ventas para mostrar.')).toBeInTheDocument();
  });

  it('descarta la respuesta tardia si se cambia de producto', async () => {
    const d = deferred<any>();
    detalleRespuesta = d.promise;
    const { rerender } = renderDrawer(PRODUCTO);
    fireEvent.click(await botonVentas());

    rerender(
      <ProductDrawer
        producto={PRODUCTO_B}
        empresaNombre="IMPORT EXPORT VIDA DIGITAL LTDA."
        session={SESSION}
        open={true}
        onOpenChange={() => {}}
        onUpdated={() => {}}
      />
    );

    await act(async () => { d.resolve({ ok: true, json: async () => VENTAS }); });
    expect(screen.queryByText('CLIENTE A')).not.toBeInTheDocument();
  });

  it('smoke: abre, muestra filas, cierra', async () => {
    renderDrawer();
    const boton = await botonVentas();
    fireEvent.click(boton);
    expect(await screen.findByText('CLIENTE A')).toBeInTheDocument();
    expect(screen.getAllByText(/2026|2025|20\d\d/).length).toBeGreaterThan(0);
    fireEvent.click(boton);
    expect(screen.queryByText('CLIENTE A')).not.toBeInTheDocument();
  });
});
