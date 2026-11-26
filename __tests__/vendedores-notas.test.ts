/**
 * S2a — Fase B: tests que intentan romper la API de notas de VENDEDORES.
 * S12a — modoFecha venta/facturacion reemplaza el par de visacion.
 */
import {
  empresasDe,
  fechaValida,
  fechaFiltroValida,
  validarFiltrosGuardados,
  parsearFiltros,
  construirConsulta,
  consultaVendedores,
  fetchNotas,
  type FiltrosNotas,
} from '@/lib/vendedores-notas';
import { parsearModoFecha } from '@/lib/filtros-validacion';

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
    modoFecha: 'venta',
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

describe('fechaFiltroValida (campos del cliente)', () => {
  it.each(['', '2026-11-11', '2000-01-01', '2100-12-31'])('acepta %p', (f) => {
    expect(fechaFiltroValida(f)).toBe(true);
  });

  it.each(['0002-11-11', '102026-02-11', '2026-13-01', '2026-1-1', '1999-12-31', '2101-01-01'])(
    'rechaza %p',
    (f) => {
      expect(fechaFiltroValida(f)).toBe(false);
    }
  );
});

describe('parsearModoFecha', () => {
  it('vacio o venta -> venta; facturacion -> facturacion; otra cosa -> null', () => {
    expect(parsearModoFecha('')).toBe('venta');
    expect(parsearModoFecha('venta')).toBe('venta');
    expect(parsearModoFecha('facturacion')).toBe('facturacion');
    expect(parsearModoFecha('facturación')).toBeNull();
    expect(parsearModoFecha('foo')).toBeNull();
  });
});

describe('validarFiltrosGuardados', () => {
  const GUARDADOS = {
    vendedor: ' PRAVIN ',
    desde: '2026-11-01',
    hasta: '2026-11-11',
    estado: 'todas',
    empresa: 'todas',
    modoFecha: 'venta',
  };

  it('normaliza: recorta y conserva las fechas vacias', () => {
    const r = validarFiltrosGuardados(GUARDADOS);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros).toEqual({
      vendedor: 'PRAVIN',
      desde: '2026-11-01',
      hasta: '2026-11-11',
      estado: 'todas',
      empresa: 'todas',
      modoFecha: 'venta',
    });
  });

  it('claves ausentes quedan como "sin filtro" y modo fecha venta', () => {
    const r = validarFiltrosGuardados({});
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros).toEqual({
      vendedor: '',
      desde: '',
      hasta: '',
      estado: 'todas',
      empresa: 'todas',
      modoFecha: 'venta',
    });
  });

  it('estado, empresa y modo fecha vacios caen a "todas"/venta', () => {
    const r = validarFiltrosGuardados({ ...GUARDADOS, estado: '', empresa: '', modoFecha: '' });
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros.estado).toBe('todas');
    expect(r.filtros.empresa).toBe('todas');
    expect(r.filtros.modoFecha).toBe('venta');
  });

  describe('migracion de filas viejas con visacion (nunca 400)', () => {
    it('visacion sin fechas de venta -> modo facturacion con esas fechas', () => {
      const r = validarFiltrosGuardados(
        {
          vendedor: 'ANGELA', desde: '', hasta: '',
          visaDesde: '2026-11-01', visaHasta: '2026-11-30',
          estado: 'facturadas', empresa: 'todas',
        }
      );
      expect('error' in r).toBe(false);
      if ('error' in r) return;
      expect(r.filtros).toEqual({
        vendedor: 'ANGELA',
        desde: '2026-11-01',
        hasta: '2026-11-30',
        estado: 'facturadas',
        empresa: 'todas',
        modoFecha: 'facturacion',
      });
    });

    it('visacion con estado "todas" tambien queda facturadas', () => {
      const r = validarFiltrosGuardados(
        { vendedor: '', desde: '', hasta: '', visaDesde: '2026-11-01', estado: 'todas', empresa: 'todas' }
      );
      expect('error' in r).toBe(false);
      if ('error' in r) return;
      expect(r.filtros).toMatchObject({ modoFecha: 'facturacion', estado: 'facturadas', desde: '2026-11-01' });
    });

    it('visacion con fechas de venta: se descarta y queda en venta', () => {
      const r = validarFiltrosGuardados(
        {
          vendedor: 'PRAVIN', desde: '2026-11-01', hasta: '2026-11-11',
          visaDesde: '2026-11-02', visaHasta: '2026-11-20',
          estado: 'facturadas', empresa: 'todas',
        }
      );
      expect('error' in r).toBe(false);
      if ('error' in r) return;
      expect(r.filtros).toEqual({
        vendedor: 'PRAVIN',
        desde: '2026-11-01',
        hasta: '2026-11-11',
        estado: 'facturadas',
        empresa: 'todas',
        modoFecha: 'venta',
      });
    });

    it('visacion + pendientes no da error: migra a facturadas', () => {
      const r = validarFiltrosGuardados(
        { vendedor: '', desde: '', hasta: '', visaDesde: '2026-11-01', estado: 'pendientes', empresa: 'todas' }
      );
      expect('error' in r).toBe(false);
      if ('error' in r) return;
      expect(r.filtros.estado).toBe('facturadas');
    });

    it('visacion con basura no da error: se ignora', () => {
      const r = validarFiltrosGuardados(
        { vendedor: '', desde: '', hasta: '', visaDesde: 'no-es-fecha', estado: 'todas', empresa: 'todas' }
      );
      expect('error' in r).toBe(false);
      if ('error' in r) return;
      expect(r.filtros).toMatchObject({ desde: '', hasta: '', modoFecha: 'venta' });
    });
  });

  it.each([
    ['null', null],
    ['array', []],
    ['texto', 'PRAVIN'],
    ['clave desconocida', { ...GUARDADOS, usuario_id: 999 }],
    ['clave limit', { ...GUARDADOS, limit: 10 }],
    ['valor no string', { ...GUARDADOS, desde: 20261101 }],
    ['visa no string', { ...GUARDADOS, visaDesde: 20261101 }],
    ['vendedor no string', { ...GUARDADOS, vendedor: { x: 1 } }],
    ['vendedor demasiado largo', { ...GUARDADOS, vendedor: 'X'.repeat(101) }],
    ['fecha invalida', { ...GUARDADOS, desde: '2026-02-30' }],
    ['fecha parcial', { ...GUARDADOS, hasta: '0002-11-11' }],
    ['rango invertido', { ...GUARDADOS, desde: '2026-11-10', hasta: '2026-11-01' }],
    ['modo fecha invalido', { ...GUARDADOS, modoFecha: 'foo' }],
    ['estado invalido', { ...GUARDADOS, estado: 'facturado' }],
    ['empresa invalida', { ...GUARDADOS, empresa: 'vida; DROP TABLE usuarios' }],
  ])('rechaza %s', (_nombre, raw) => {
    expect('error' in validarFiltrosGuardados(raw)).toBe(true);
  });
});

describe('parsearFiltros', () => {
  it('sin parametros: modo venta, sin fechas (null), todas, limit 300', () => {
    const r = parsearFiltros(new URLSearchParams(), HOY);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros).toMatchObject({
      hoy: HOY,
      desde: null,
      hasta: null,
      vendedor: null,
      modoFecha: 'venta',
      estado: null,
      limit: 300,
    });
  });

  it('fechas vacias explicitas -> null (no se reinyecta el mes)', () => {
    const r = parsearFiltros(new URLSearchParams('desde=&hasta='), HOY);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros.desde).toBeNull();
    expect(r.filtros.hasta).toBeNull();
  });

  it('modoFecha vacio -> venta', () => {
    const r = parsearFiltros(new URLSearchParams('modoFecha='), HOY);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros.modoFecha).toBe('venta');
  });

  it('modo facturacion sin estado -> fuerza facturadas', () => {
    const r = parsearFiltros(new URLSearchParams('modoFecha=facturacion&desde=2026-11-26&hasta=2026-11-26'), HOY);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros.modoFecha).toBe('facturacion');
    expect(r.filtros.estado).toBe('facturada');
    expect(r.filtros.desde).toBe('2026-11-26');
    expect(r.filtros.hasta).toBe('2026-11-26');
  });

  it('modo facturacion con estado "todas" -> facturadas', () => {
    const r = parsearFiltros(new URLSearchParams('modoFecha=facturacion&estado=todas'), HOY);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.filtros.estado).toBe('facturada');
  });

  it('modo facturacion + pendientes -> error', () => {
    const r = parsearFiltros(new URLSearchParams('modoFecha=facturacion&estado=pendientes'), HOY);
    expect('error' in r).toBe(true);
  });

  it('modo fecha invalido -> error', () => {
    expect('error' in parsearFiltros(new URLSearchParams('modoFecha=foo'), HOY)).toBe(true);
  });

  it('fecha invalida -> error', () => {
    expect('error' in parsearFiltros(new URLSearchParams('desde=2026-02-30'), HOY)).toBe(true);
    expect('error' in parsearFiltros(new URLSearchParams('hasta=11-11-2026'), HOY)).toBe(true);
  });

  it('rango invertido -> error', () => {
    expect('error' in parsearFiltros(new URLSearchParams('desde=2026-11-10&hasta=2026-11-01'), HOY)).toBe(true);
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
    const { text, params } = consulta(['vida'], filtros({ modoFecha: 'facturacion', estado: 'facturada' }));
    expect(text).toContain('m.fechanvt <= $1::date');
    expect(params[0]).toBe(HOY);
  });

  it('modo venta filtra por fechanvt y ordena por fecha de venta', () => {
    const { text } = consulta(['vida']);
    expect(text).toContain('($2::date IS NULL OR m.fechanvt >= $2::date)');
    expect(text).toContain('($3::date IS NULL OR m.fechanvt <= $3::date)');
    expect(text).not.toContain('m.fechadoc >= $2::date');
    expect(text).toContain('ORDER BY n.fecha_venta DESC, n.empresa, n.nota DESC');
  });

  it('modo facturacion filtra por fechadoc y ordena por fecha de facturacion (nulls al final)', () => {
    const { text } = consulta(['vida'], filtros({ modoFecha: 'facturacion', estado: 'facturada' }));
    expect(text).toContain('($2::date IS NULL OR m.fechadoc >= $2::date)');
    expect(text).toContain('($3::date IS NULL OR m.fechadoc <= $3::date)');
    expect(text).not.toContain('m.fechanvt >= $2::date');
    expect(text).toContain('ORDER BY n.fecha_facturacion DESC NULLS LAST, n.empresa, n.nota DESC');
    // el corte de futuras sigue siendo por venta
    expect(text).toContain('m.fechanvt <= $1::date');
  });

  it('desde/hasta null no restringen la fecha elegida pero las futuras siguen fuera', () => {
    const venta = consulta(['vida'], filtros({ desde: null, hasta: null }));
    expect(venta.text).toContain('($2::date IS NULL OR m.fechanvt >= $2::date)');
    expect(venta.params[1]).toBeNull();
    expect(venta.params[2]).toBeNull();

    const fact = consulta(['vida'], filtros({ desde: null, hasta: null, modoFecha: 'facturacion', estado: 'facturada' }));
    expect(fact.text).toContain('($2::date IS NULL OR m.fechadoc >= $2::date)');
    expect(fact.text).toContain('($3::date IS NULL OR m.fechadoc <= $3::date)');
    expect(fact.text).toContain('m.fechanvt <= $1::date');
    expect(fact.params[1]).toBeNull();
    expect(fact.params[2]).toBeNull();
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

  it('parametros en orden: hoy, desde, hasta, vendedor, estado, limit', () => {
    const f = filtros({
      vendedor: 'PRAVIN',
      modoFecha: 'facturacion',
      estado: 'facturada',
      limit: 50,
    });
    const { params } = consulta(['vida'], f);
    expect(params).toEqual([HOY, '2026-11-01', HOY, 'PRAVIN', 'facturada', 50]);
  });

  it('no interpola texto del usuario en el SQL', () => {
    const ataque = "x'; DROP TABLE vida.movidcto; --";
    const { text, params } = consulta(['vida'], filtros({ vendedor: ataque }));
    expect(text).not.toContain('DROP TABLE');
    expect(text).not.toContain(ataque);
    expect(params[3]).toBe(ataque);
  });

  it('el limit va como parametro $6, no interpolado', () => {
    const { text, params } = consulta(['vida'], filtros({ limit: 42 }));
    expect(text).toContain('LIMIT $6');
    expect(text).not.toContain('LIMIT 42');
    expect(params[5]).toBe(42);
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
