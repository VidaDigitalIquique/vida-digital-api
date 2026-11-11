import { sql } from '@/lib/db';
import { schemaDeEmpresa } from '@/lib/ventas-producto';

export type EmpresaSlug = 'vida' | 'sanjh';
export type EstadoNota = 'facturada' | 'pendiente';

export interface FiltrosNotas {
  hoy: string; // YYYY-MM-DD en hora de Chile: corta las notas futuras
  desde: string;
  hasta: string;
  vendedor: string | null;
  visaDesde: string | null;
  visaHasta: string | null;
  estado: EstadoNota | null; // null = todas
  limit: number;
}

export interface NotaVenta {
  empresa: EmpresaSlug;
  empresa_nombre: string;
  fecha_venta: string;
  nota: string;
  cliente: string;
  vendedor: string;
  total_usd: number;
  estado: EstadoNota;
  visacion: string | null;
  fecha_facturacion: string | null;
}

export interface NotasResultado {
  notas: NotaVenta[];
  vendedores: string[];
  total: number;
}

const NOMBRE_EMPRESA: Record<EmpresaSlug, string> = { vida: 'Vida Digital', sanjh: 'SANJH' };

// El esquema sale SOLO de este mapa (claves fijas): nunca del texto del usuario.
export function empresasDe(valor: string | null): EmpresaSlug[] | null {
  if (!valor || valor === 'todas') return ['vida', 'sanjh'];
  const esquema = schemaDeEmpresa(valor);
  return esquema ? [esquema] : null;
}

export function fechaValida(valor: string | null): boolean {
  if (valor === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const t = Date.parse(`${valor}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === valor;
}

export function parsearFiltros(
  searchParams: URLSearchParams,
  hoy: string
): { filtros: FiltrosNotas } | { error: string } {
  const desdeRaw = searchParams.get('desde');
  const hastaRaw = searchParams.get('hasta');
  const visaDesdeRaw = searchParams.get('visaDesde');
  const visaHastaRaw = searchParams.get('visaHasta');

  for (const [nombre, valor] of [
    ['desde', desdeRaw],
    ['hasta', hastaRaw],
    ['visaDesde', visaDesdeRaw],
    ['visaHasta', visaHastaRaw],
  ] as const) {
    if (!fechaValida(valor)) return { error: `fecha ${nombre} inválida` };
  }

  const desde = desdeRaw || `${hoy.slice(0, 7)}-01`;
  const hasta = hastaRaw || hoy;
  const visaDesde = visaDesdeRaw || null;
  const visaHasta = visaHastaRaw || null;
  if (desde > hasta) return { error: 'rango de fecha de venta inválido' };
  if (visaDesde && visaHasta && visaDesde > visaHasta) {
    return { error: 'rango de fecha de visación inválido' };
  }

  const estadoParam = searchParams.get('estado') ?? 'todas';
  let estado: EstadoNota | null;
  if (estadoParam === 'todas') estado = null;
  else if (estadoParam === 'pendientes') estado = 'pendiente';
  else if (estadoParam === 'facturadas') estado = 'facturada';
  else return { error: 'estado inválido' };

  if ((visaDesde || visaHasta) && estado === 'pendiente') {
    return { error: 'el rango de visación solo aplica a notas facturadas' };
  }
  if (visaDesde || visaHasta) estado = 'facturada';

  const limitRaw = searchParams.get('limit');
  let limit = 300;
  if (limitRaw !== null) {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1) return { error: 'limit inválido' };
    limit = Math.min(n, 500);
  }

  return {
    filtros: { hoy, desde, hasta, vendedor: searchParams.get('vendedor')?.trim() || null, visaDesde, visaHasta, estado, limit },
  };
}

function bloqueNotas(esquema: EmpresaSlug): string {
  return `
  SELECT '${esquema}' AS empresa,
         m.knumfoli::text AS nota,
         to_char(m.fechanvt, 'YYYY-MM-DD') AS fecha_venta,
         COALESCE(m.cliente,'') AS cliente,
         btrim(COALESCE(m.vendedor,'')) AS vendedor,
         COALESCE(m.val_rea,0)::float8 AS total_usd,
         CASE WHEN m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> ''
              THEN 'facturada' ELSE 'pendiente' END AS estado,
         NULLIF(btrim(COALESCE(m.visaadua,'')),'') AS visacion,
         to_char(m.fechadoc, 'YYYY-MM-DD') AS fecha_facturacion
  FROM ${esquema}.movidcto m
  WHERE m.tipomovi='V'
    AND m.id_tdocu IN ('203','551','554')
    AND m.fechanvt <= $1::date
    AND m.fechanvt >= $2::date
    AND m.fechanvt <= $3::date
    AND btrim(COALESCE(m.vendedor,'')) <> ''
    AND btrim(upper(COALESCE(m.vendedor,''))) NOT IN ('PABLO BRAVO','EMPRESA')
    AND ((m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> '')
      OR (m.pestadot='1' AND btrim(COALESCE(m.visaadua,'')) = ''))
    AND EXISTS (SELECT 1 FROM ${esquema}.itemdcto i WHERE i.knumfoli = m.knumfoli)
    AND ($4::text IS NULL OR btrim(upper(m.vendedor)) = btrim(upper($4)))
    AND ($5::date IS NULL OR m.fechadoc >= $5::date)
    AND ($6::date IS NULL OR m.fechadoc <= $6::date)
    AND ($7::text IS NULL
      OR ($7='facturada' AND m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> '')
      OR ($7='pendiente' AND m.pestadot='1' AND btrim(COALESCE(m.visaadua,'')) = ''))`;
}

export function construirConsulta(
  empresas: EmpresaSlug[],
  filtros: FiltrosNotas
): { text: string; params: unknown[] } {
  const text = `SELECT n.*, COUNT(*) OVER() AS total
FROM (${empresas.map(bloqueNotas).join('\n  UNION ALL\n')}) n
ORDER BY n.fecha_venta DESC, n.empresa, n.nota DESC
LIMIT $8`;
  return {
    text,
    params: [
      filtros.hoy,
      filtros.desde,
      filtros.hasta,
      filtros.vendedor,
      filtros.visaDesde,
      filtros.visaHasta,
      filtros.estado,
      filtros.limit,
    ],
  };
}

export function consultaVendedores(esquema: EmpresaSlug): string {
  return `SELECT DISTINCT btrim(m.vendedor) AS vendedor
FROM ${esquema}.movidcto m
WHERE m.tipomovi='V'
  AND m.id_tdocu IN ('203','551','554')
  AND m.fechanvt <= $1::date
  AND btrim(COALESCE(m.vendedor,'')) <> ''
  AND btrim(upper(COALESCE(m.vendedor,''))) NOT IN ('PABLO BRAVO','EMPRESA')
ORDER BY 1`;
}

type FilaNota = {
  empresa: string;
  nota: string;
  fecha_venta: string;
  cliente: string | null;
  vendedor: string | null;
  total_usd: unknown;
  estado: string;
  visacion: string | null;
  fecha_facturacion: string | null;
  total: unknown;
};

type FilaVendedor = { vendedor: string };

export async function fetchNotas(
  empresas: EmpresaSlug[],
  filtros: FiltrosNotas
): Promise<NotasResultado> {
  const { text, params } = construirConsulta(empresas, filtros);
  const [filasRaw, listasRaw] = await Promise.all([
    sql.query(text, params),
    Promise.all(empresas.map((e) => sql.query(consultaVendedores(e), [filtros.hoy]))),
  ]);
  const filas = (filasRaw ?? []) as unknown as FilaNota[];
  const listas = (listasRaw ?? []) as unknown as FilaVendedor[][];

  const notas: NotaVenta[] = filas.map((r) => {
    const empresa: EmpresaSlug = r.empresa === 'sanjh' ? 'sanjh' : 'vida';
    return {
      empresa,
      empresa_nombre: NOMBRE_EMPRESA[empresa],
      fecha_venta: String(r.fecha_venta),
      nota: String(r.nota),
      cliente: r.cliente ?? '',
      vendedor: r.vendedor ?? '',
      total_usd: Number(r.total_usd) || 0,
      estado: r.estado === 'facturada' ? 'facturada' : 'pendiente',
      visacion: r.visacion ?? null,
      fecha_facturacion: r.fecha_facturacion ?? null,
    };
  });

  const vendedores = Array.from(new Set(listas.flat().map((v) => v.vendedor).filter(Boolean))).sort();

  return { notas, vendedores, total: Number(filas[0]?.total ?? 0) };
}
