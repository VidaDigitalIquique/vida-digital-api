/**
 * S2a — Fase B: tests que intentan romper la API de notas de VENDEDORES.
 * Estado inicial: ROJO (lib/vendedores-notas.ts aun no existe).
 */
import {
  empresasDe,
  fechaValida,
  parsearFiltros,
  construirConsulta,
  consultaVendedores,
  fetchNotas,
  type FiltrosNotas,
} from '@/lib/vendedores-notas';

const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  sql: { query: (...args: unknown[]) => queryMock(...args) },
}));

const HOY = '2026-11-11';

function filtros(over: Partial<FiltrosNotas> = {}): FiltrosNotas {
  return {
    hoy: HOY,
    desde: '2026-11-01',
    hasta: HOY,
    vendedor: null,
    visaDesde: null,
    visaHasta: null,
    estado: null,
    limit: 300,
    ...over,
  };
}

function consulta(empresas: ('vida' | 'sanjh')[], f = filtros()) {
  return construirConsulta(empresas, f);
}

describe('empresasDe', () => {
  it('sin valor o "todas" -> ambas empresas', () => {
    expect(empresasDe(null)).toEqual(['vida', 'sanjh']);
    expect(empresasDe('todas')).toEqual(['vida', 'sanjh']);
  });

  it('vida y sanjh -> una sola', () => {
    expect(empresasDe('vida')).toEqual(['vida']);
    expect(empresasDe('sanjh')).toEqual(['sanjh']);
  });

  it('empresa desconocida o intento de inyeccion -> null (400)', () => {
    expect(empresasDe('foo')).toBeNull();
    expect(empresasDe("vida; DROP TABLE vida.movidcto")).toBeNull();
  });
});

describe('fechaValida', () => {
  it.each(['2026-11-11', '2024-02-29', null])('valida %p', (f) => {
    expect(fechaValida(f)).toBe(true);
  });

  it.each(['', '2026-13-01', '2026-02-30', '11-11-2026', '2026-1-1', '2026-11-11T00:00'])(
    'rechaza %p',
    (f) => {
      expect(fechaValida(f)).toBe(false);
    }
  );
});

describe('parsearFiltros', () => {
  it('sin parametros: mes en curso hasta hoy, todas, limit 300', () => {
    const r = parsearFiltros(new URLSearchParams(), HOY);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros).toMatchObject({
      hoy: HOY,
      desde: '2026-11-01',
      hasta: HOY,
      vendedor: null,
      visaDesde: null,
      visaHasta: null,
      estado: null,
      limit: 300,
    });
  });

  it('rango de visacion sin estado -> fuerza facturadas', () => {
    const r = parsearFiltros(new URLSearchParams('visaDesde=2026-11-01&visaHasta=2026-11-30'), HOY);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros.estado).toBe('facturada');
    expect(r.filtros.visaDesde).toBe('2026-11-01');
    expect(r.filtros.visaHasta).toBe('2026-11-30');
  });

  it('rango de visacion + pendientes -> error', () => {
    const r = parsearFiltros(new URLSearchParams('visaDesde=2026-11-01&estado=pendientes'), HOY);
    expect('error' in r).toBe(true);
  });

  it('fecha invalida -> error', () => {
    expect('error' in parsearFiltros(new URLSearchParams('desde=2026-02-30'), HOY)).toBe(true);
    expect('error' in parsearFiltros(new URLSearchParams('hasta=11-11-2026'), HOY)).toBe(true);
    expect('error' in parsearFiltros(new URLSearchParams('visaHasta=foo'), HOY)).toBe(true);
  });

  it('rango invertido -> error', () => {
    expect('error' in parsearFiltros(new URLSearchParams('desde=2026-11-10&hasta=2026-11-01'), HOY)).toBe(true);
    expect('error' in parsearFiltros(new URLSearchParams('visaDesde=2026-11-10&visaHasta=2026-11-01'), HOY)).toBe(true);
  });

  it('estado invalido -> error', () => {
    expect('error' in parsearFiltros(new URLSearchParams('estado=facturado'), HOY)).toBe(true);
  });

  it('limit: maximo 500, cero o no numerico -> error', () => {
    const r500 = parsearFiltros(new URLSearchParams('limit=9999'), HOY);
    expect('error' in r500).toBe(false);
    if (!('error' in r500)) expect(r500.filtros.limit).toBe(500);

    expect('error' in parsearFiltros(new URLSearchParams('limit=0'), HOY)).toBe(true);
    expect('error' in parsearFiltros(new URLSearchParams('limit=abc'), HOY)).toBe(true);
    expect('error' in parsearFiltros(new URLSearchParams('limit=10.5'), HOY)).toBe(true);
  });

  it('vendedor con espacios se recorta; vacio -> null', () => {
    const r = parsearFiltros(new URLSearchParams('vendedor=%20PRAVIN%20'), HOY);
    expect('error' in r).toBe(false);
    if (!('error' in r)) expect(r.filtros.vendedor).toBe('PRAVIN');

    const vacio = parsearFiltros(new URLSearchParams('vendedor='), HOY);
    if (!('error' in vacio)) expect(vacio.filtros.vendedor).toBeNull();
  });
});

describe('construirConsulta', () => {
  it('empresa=todas incluye vida y sanjh', () => {
    const { text } = consulta(['vida', 'sanjh']);
    expect(text).toContain('vida.movidcto');
    expect(text).toContain('sanjh.movidcto');
    expect(text).toContain('UNION ALL');
  });

  it('empresa=vida NO menciona el esquema sanjh', () => {
    const { text } = consulta(['vida']);
    expect(text).toContain('vida.movidcto');
    expect(text).not.toContain('sanjh.');
  });

  it('futuras: siempre filtra <= hoy, con hoy como $1', () => {
    const { text, params } = consulta(['vida']);
    expect(text).toContain('m.fechanvt <= $1::date');
    expect(params[0]).toBe(HOY);
  });

  it('excluye PABLO BRAVO, EMPRESA, NULL y vacio', () => {
    const { text } = consulta(['sanjh']);
    expect(text).toContain("NOT IN ('PABLO BRAVO','EMPRESA')");
    expect(text).toContain("btrim(COALESCE(m.vendedor,'')) <> ''");
  });

  it('excluye pendientes sin lineas (EXISTS en itemdcto del mismo esquema)', () => {
    const { text } = consulta(['vida']);
    expect(text).toContain('EXISTS');
    expect(text).toContain('vida.itemdcto');
    expect(text).toContain('i.knumfoli = m.knumfoli');
  });

  it('solo admite las dos combinaciones validas de estado', () => {
    const { text } = consulta(['vida']);
    expect(text).toContain("m.pestadot='3'");
    expect(text).toContain("m.pestadot='1'");
    expect(text).toContain('visaadua');
  });

  it('parametros en orden: hoy, desde, hasta, vendedor, visa, estado, limit', () => {
    const f = filtros({
      vendedor: 'PRAVIN',
      visaDesde: '2026-11-01',
      visaHasta: '2026-11-30',
      estado: 'facturada',
      limit: 50,
    });
    const { params } = consulta(['vida'], f);
    expect(params).toEqual([HOY, '2026-11-01', HOY, 'PRAVIN', '2026-11-01', '2026-11-30', 'facturada', 50]);
  });

  it('no interpola texto del usuario en el SQL', () => {
    const ataque = "x'; DROP TABLE vida.movidcto; --";
    const { text, params } = consulta(['vida'], filtros({ vendedor: ataque }));
    expect(text).not.toContain('DROP TABLE');
    expect(text).not.toContain(ataque);
    expect(params[3]).toBe(ataque);
  });

  it('el limit va como parametro, no interpolado', () => {
    const { text, params } = consulta(['vida'], filtros({ limit: 42 }));
    expect(text).toContain('LIMIT $8');
    expect(params[7]).toBe(42);
  });
});

describe('consultaVendedores', () => {
  it('lista validos, sin excluidos, acotada a hoy', () => {
    const text = consultaVendedores('vida');
    expect(text).toContain('vida.movidcto');
    expect(text).toContain('DISTINCT');
    expect(text).toContain("NOT IN ('PABLO BRAVO','EMPRESA')");
    expect(text).toContain('m.fechanvt <= $1::date');
    expect(text).not.toContain('sanjh.');
  });
});

describe('fetchNotas', () => {
  beforeEach(() => queryMock.mockReset());

  it('mapea filas y deduplica vendedores entre empresas', async () => {
    queryMock.mockImplementation((text: string) => {
      if (text.includes('DISTINCT')) {
        return Promise.resolve(
          text.includes('sanjh')
            ? [{ vendedor: 'ANGELA' }]
            : [{ vendedor: 'PRAVIN' }, { vendedor: 'ANGELA' }]
        );
      }
      return Promise.resolve([
        {
          empresa: 'vida',
          nota: '002514',
          fecha_venta: '2026-11-09',
          cliente: 'MILENKA',
          vendedor: 'PRAVIN',
          total_usd: 825,
          estado: 'facturada',
          visacion: '431033',
          fecha_facturacion: '2026-11-10',
          total: '2',
        },
        {
          empresa: 'sanjh',
          nota: '003000',
          fecha_venta: '2026-11-08',
          cliente: 'JOHN',
          vendedor: 'ANGELA',
          total_usd: '150.5',
          estado: 'pendiente',
          visacion: null,
          fecha_facturacion: null,
          total: '2',
        },
      ]);
    });

    const r = await fetchNotas(['vida', 'sanjh'], filtros());

    expect(r.total).toBe(2);
    expect(r.vendedores).toEqual(['ANGELA', 'PRAVIN']);
    expect(r.notas[0]).toEqual({
      empresa: 'vida',
      empresa_nombre: 'Vida Digital',
      fecha_venta: '2026-11-09',
      nota: '002514',
      cliente: 'MILENKA',
      vendedor: 'PRAVIN',
      total_usd: 825,
      estado: 'facturada',
      visacion: '431033',
      fecha_facturacion: '2026-11-10',
    });
    expect(r.notas[1]).toMatchObject({
      empresa_nombre: 'SANJH',
      total_usd: 150.5,
      estado: 'pendiente',
      visacion: null,
      fecha_facturacion: null,
    });
  });

  it('sin filas: total 0 y lista vacia', async () => {
    queryMock.mockImplementation(() => Promise.resolve([]));
    const r = await fetchNotas(['vida'], filtros());
    expect(r).toEqual({ notas: [], vendedores: [], total: 0 });
  });

  it('consulta vendedores una vez por empresa seleccionada', async () => {
    queryMock.mockImplementation(() => Promise.resolve([]));
    await fetchNotas(['vida', 'sanjh'], filtros());
    const llamadas = queryMock.mock.calls.map((c) => String(c[0]));
    expect(llamadas.filter((t) => t.includes('DISTINCT')).length).toBe(2);
  });
});
