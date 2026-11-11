/**
 * S4a — Fase B: libreria pura del detalle de una nota + consultas (R7).
 * Estado inicial: ROJO (lib/vendedores-detalle.ts y las funciones no existen).
 */
import {
  porcentajeSobreCosto,
  gananciaLinea,
  sumaLineas,
  totalGanancia,
  diferenciaNota,
  type LineaDetalle,
} from '@/lib/vendedores-detalle';
import { construirConsultaDetalle, fetchDetalleNota } from '@/lib/vendedores-notas';

const queryMock = jest.fn();

jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

function linea(over: Partial<LineaDetalle> = {}): LineaDetalle {
  return {
    codigo: 'HS-108',
    costo: 42.3,
    precio: 52,
    cajas: 1,
    unidades: 10,
    total_linea: 520,
    imagen_url: null,
    ...over,
  };
}

const CABECERA = {
  nota: '003816',
  fecha_venta: '2026-11-05',
  cliente: 'DILIP MAYANI',
  cliente_factura: 'IMPORT EXPORT VED SPA',
  vendedor: 'ANGELA',
  total_usd: 1040,
  estado: 'facturada',
  visacion: '431033',
  fecha_visacion: '2026-11-06',
};

beforeEach(() => queryMock.mockReset());

describe('porcentajeSobreCosto', () => {
  it('(precio - costo) / costo * 100', () => {
    expect(porcentajeSobreCosto(52, 42.3)).toBeCloseTo(((52 - 42.3) / 42.3) * 100, 10);
  });

  it('costo 0, negativo o no finito -> null (nunca Infinity/NaN)', () => {
    expect(porcentajeSobreCosto(10, 0)).toBeNull();
    expect(porcentajeSobreCosto(10, -1)).toBeNull();
    expect(porcentajeSobreCosto(10, Number.NaN)).toBeNull();
    expect(porcentajeSobreCosto(10, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('ganancia y sumas', () => {
  it('ganancia de linea = (precio - costo) * unidades, sin redondear', () => {
    expect(gananciaLinea(52, 42.3, 10)).toBeCloseTo(97, 10);
    expect(gananciaLinea(10.005, 10, 3)).toBeCloseTo(0.015, 10);
  });

  it('sumaLineas usa total_linea (totalrea, no precio*unidades)', () => {
    const lineas = [linea({ total_linea: 520 }), linea({ total_linea: 26.4 })];
    expect(sumaLineas(lineas)).toBeCloseTo(546.4, 10);
    expect(sumaLineas([])).toBe(0);
  });

  it('totalGanancia suma todas las lineas', () => {
    const lineas = [linea(), linea({ precio: 100, costo: 80, unidades: 2 })];
    expect(totalGanancia(lineas)).toBeCloseTo(97 + 40, 10);
    expect(totalGanancia([])).toBe(0);
  });
});

describe('diferenciaNota (aviso D13/D14)', () => {
  it('lineas que suman mas que el total -> diferencia positiva', () => {
    expect(diferenciaNota(2550, 2731.5)).toBeCloseTo(181.5, 10);
  });

  it('tolerancia 0,01: diferencias minimas no generan aviso', () => {
    expect(diferenciaNota(2550, 2550)).toBeNull();
    expect(diferenciaNota(2550, 2550.004)).toBeNull();
    expect(diferenciaNota(2550, 2549.996)).toBeNull();
    expect(diferenciaNota(0, 0)).toBeNull();
  });

  it('lineas que suman menos -> diferencia negativa (se avisa igual)', () => {
    expect(diferenciaNota(1000, 900)).toBeCloseTo(-100, 10);
  });
});

describe('construirConsultaDetalle', () => {
  it('la imagen usa LEFT JOIN LATERAL ... LIMIT 1 (no multiplica lineas)', () => {
    const { lineas } = construirConsultaDetalle('vida');
    expect(lineas).toContain('LEFT JOIN LATERAL');
    expect(lineas).toContain('LIMIT 1');
    expect(lineas).not.toContain('JOIN public.productos');
  });

  it('empresa_id del producto segun esquema: sanjh=1, vida=2', () => {
    expect(construirConsultaDetalle('sanjh').lineas).toContain('empresa_id = 1');
    expect(construirConsultaDetalle('sanjh').lineas).toContain('sanjh.itemdcto');
    expect(construirConsultaDetalle('vida').lineas).toContain('empresa_id = 2');
    expect(construirConsultaDetalle('vida').lineas).not.toContain('sanjh.');
  });

  it('la imagen es la mas reciente con imagen no nula, determinista', () => {
    const { lineas } = construirConsultaDetalle('vida');
    expect(lineas).toContain('imagen_url IS NOT NULL');
    expect(lineas).toContain('ORDER BY p.fecha_ingreso DESC NULLS LAST, p.id DESC');
  });

  it('la suma usa totalrea con fallback a precread*cantsali', () => {
    const { lineas } = construirConsultaDetalle('vida');
    expect(lineas).toContain('COALESCE(i.totalrea, i.precread*i.cantsali)::float8 AS total_linea');
  });

  it('cabecera: reglas del modulo, factura y nota como $2', () => {
    const { cabecera } = construirConsultaDetalle('vida');
    expect(cabecera).toContain('m.factura');
    expect(cabecera).toContain('m.fechanvt <= $1::date');
    expect(cabecera).toContain("NOT IN ('PABLO BRAVO','EMPRESA')");
    expect(cabecera).toContain('EXISTS');
    expect(cabecera).toContain('m.knumfoli = $2');
    expect(cabecera).toContain('LIMIT 1');
  });
});

describe('fetchDetalleNota', () => {
  it('mapea cabecera y lineas y calcula la diferencia con total_linea', async () => {
    queryMock
      .mockResolvedValueOnce([CABECERA])
      .mockResolvedValueOnce([
        { codigo: 'HS-108', costo: '42.30', precio: '52', cajas: '1', unidades: '10', total_linea: '520', imagen_url: 'https://x/1.jpg' },
        { codigo: 'HS-109', costo: '42.30', precio: '52', cajas: '1', unidades: '10', total_linea: '520', imagen_url: null },
      ]);

    const d = await fetchDetalleNota('sanjh', '003816', '2026-11-11');

    expect(queryMock.mock.calls[0][1]).toEqual(['2026-11-11', '003816']);
    expect(queryMock.mock.calls[1][1]).toEqual(['003816']);
    expect(d).toEqual({
      empresa: 'sanjh',
      empresa_nombre: 'SANJH',
      nota: '003816',
      fecha_venta: '2026-11-05',
      cliente: 'DILIP MAYANI',
      cliente_factura: 'IMPORT EXPORT VED SPA',
      vendedor: 'ANGELA',
      total_usd: 1040,
      estado: 'facturada',
      visacion: '431033',
      fecha_visacion: '2026-11-06',
      lineas: [
        { codigo: 'HS-108', costo: 42.3, precio: 52, cajas: 1, unidades: 10, total_linea: 520, imagen_url: 'https://x/1.jpg' },
        { codigo: 'HS-109', costo: 42.3, precio: 52, cajas: 1, unidades: 10, total_linea: 520, imagen_url: null },
      ],
      diferencia_usd: null,
    });
  });

  it('calcula diferencia cuando las lineas no suman al total', async () => {
    queryMock
      .mockResolvedValueOnce([{ ...CABECERA, nota: '002499', total_usd: 2550 }])
      .mockResolvedValueOnce([
        { codigo: 'HS-30', costo: '100', precio: '150', cajas: '2', unidades: '17', total_linea: '2550', imagen_url: null },
        { codigo: '303', costo: '10', precio: '20', cajas: '1', unidades: '9.075', total_linea: '181.5', imagen_url: null },
      ]);

    const d = await fetchDetalleNota('vida', '002499', '2026-11-11');
    expect(d?.diferencia_usd).toBeCloseTo(181.5, 10);
  });

  it('nota fuera del modulo (cabecera vacia) -> null y no consulta lineas', async () => {
    queryMock.mockResolvedValueOnce([]);
    const d = await fetchDetalleNota('vida', '009999', '2026-11-11');
    expect(d).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('conserva lineas duplicadas (D14), no deduplica', async () => {
    queryMock
      .mockResolvedValueOnce([CABECERA])
      .mockResolvedValueOnce([
        { codigo: '1030A', costo: '1', precio: '2', cajas: '1', unidades: '1', total_linea: '2', imagen_url: null },
        { codigo: '1030A', costo: '1', precio: '2', cajas: '1', unidades: '1', total_linea: '2', imagen_url: null },
      ]);
    const d = await fetchDetalleNota('sanjh', '000812', '2026-11-11');
    expect(d?.lineas).toHaveLength(2);
  });

  it('nunca interpola el texto de la nota en el SQL', async () => {
    queryMock.mockResolvedValueOnce([]);
    await fetchDetalleNota('vida', "1'; DROP TABLE vida.movidcto; --", '2026-11-11');
    const text = String(queryMock.mock.calls[0][0]);
    expect(text).not.toContain('DROP TABLE');
  });
});
