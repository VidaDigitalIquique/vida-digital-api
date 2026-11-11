import { sql } from '@/lib/db';
import { schemaDeEmpresa } from '@/lib/ventas-producto';
import {
  CLAVES_FILTROS,
  fechaFiltroValida,
  fechaValida,
  parsearEstado,
  type FiltrosGuardados,
} from '@/lib/filtros-validacion';

export { fechaFiltroValida, fechaValida, parsearEstado } from '@/lib/filtros-validacion';
export type { FiltrosGuardados } from '@/lib/filtros-validacion';

export type EmpresaSlug = 'vida' | 'sanjh';
export type EstadoNota = 'facturada' | 'pendiente';

export interface FiltrosNotas {
  hoy: string; // YYYY-MM-DD en hora de Chile: corta las notas futuras
  desde: string | null; // null = sin limite inferior (solo hay filtro de visacion)
  hasta: string | null; // null = sin limite superior (solo hay filtro de visacion)
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

  // Sin fechas de venta pero con rango de visacion: no se restringe la venta
  // (solo se cortan las futuras con hoy). Con cualquier fecha de venta se
  // completa el default de mes que ya existia.
  const soloVisacion = !desdeRaw && !hastaRaw && Boolean(visaDesdeRaw || visaHastaRaw);
  const desde = soloVisacion ? null : desdeRaw || `${hoy.slice(0, 7)}-01`;
  const hasta = soloVisacion ? null : hastaRaw || hoy;
  const visaDesde = visaDesdeRaw || null;
  const visaHasta = visaHastaRaw || null;
  if (desde && hasta && desde > hasta) return { error: 'rango de fecha de venta inválido' };
  if (visaDesde && visaHasta && visaDesde > visaHasta) {
    return { error: 'rango de fecha de visación inválido' };
  }

  const estadoParam = parsearEstado(searchParams.get('estado') ?? 'todas');
  if (!estadoParam) return { error: 'estado inválido' };
  let estado: EstadoNota | null = estadoParam === 'todas' ? null : estadoParam === 'pendientes' ? 'pendiente' : 'facturada';

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

/**
 * Valida y normaliza el JSON guardado por usuario. Reutiliza la validacion de
 * parsearFiltros (fechas, rangos, estado, visacion) sin aplicarle los defaults
 * de mes: lo guardado son las fechas tal como estan en los campos ('' = vacio).
 */
export function validarFiltrosGuardados(
  raw: unknown,
  hoy: string
): { filtros: FiltrosGuardados } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'filtros inválidos' };
  const obj = raw as Record<string, unknown>;
  for (const clave of Object.keys(obj)) {
    if (!(CLAVES_FILTROS as readonly string[]).includes(clave)) {
      return { error: `clave desconocida: ${clave}` };
    }
  }

  const campos = {} as Record<(typeof CLAVES_FILTROS)[number], string>;
  for (const clave of CLAVES_FILTROS) {
    const valor = obj[clave] ?? '';
    if (typeof valor !== 'string') return { error: `${clave} inválido` };
    campos[clave] = valor.trim();
  }
  if (campos.vendedor.length > 100) return { error: 'vendedor inválido' };
  for (const clave of ['desde', 'hasta', 'visaDesde', 'visaHasta'] as const) {
    if (!fechaFiltroValida(campos[clave])) return { error: `fecha ${clave} inválida` };
  }
  const empresa = empresasDe(campos.empresa)
    ? ((campos.empresa || 'todas') as FiltrosGuardados['empresa'])
    : null;
  if (!empresa) return { error: 'empresa inválida' };
  const estado = parsearEstado(campos.estado || 'todas');
  if (!estado) return { error: 'estado inválido' };

  const sp = new URLSearchParams();
  for (const clave of ['vendedor', 'desde', 'hasta', 'visaDesde', 'visaHasta'] as const) {
    if (campos[clave]) sp.set(clave, campos[clave]);
  }
  if (campos.estado) sp.set('estado', campos.estado);
  const parsed = parsearFiltros(sp, hoy);
  if ('error' in parsed) return parsed;

  return {
    filtros: {
      vendedor: campos.vendedor,
      desde: campos.desde,
      hasta: campos.hasta,
      visaDesde: campos.visaDesde,
      visaHasta: campos.visaHasta,
      estado,
      empresa,
    },
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
    AND ($2::date IS NULL OR m.fechanvt >= $2::date)
    AND ($3::date IS NULL OR m.fechanvt <= $3::date)
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
