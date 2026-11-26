import { sql } from '@/lib/db';
import { schemaDeEmpresa } from '@/lib/ventas-producto';
import {
  diferenciaNota,
  sumaLineas,
  type DetalleNota,
  type LineaDetalle,
} from '@/lib/vendedores-detalle';
import {
  CLAVES_FILTROS,
  CLAVES_LEGADO,
  fechaFiltroValida,
  fechaValida,
  parsearEstado,
  parsearModoFecha,
  type FiltrosGuardados,
  type ModoFecha,
} from '@/lib/filtros-validacion';

export { fechaFiltroValida, fechaValida, parsearEstado, parsearModoFecha } from '@/lib/filtros-validacion';
export type { FiltrosGuardados, ModoFecha } from '@/lib/filtros-validacion';

export type EmpresaSlug = 'vida' | 'sanjh';
export type EstadoNota = 'facturada' | 'pendiente';

export interface FiltrosNotas {
  hoy: string; // YYYY-MM-DD en hora de Chile: corta las notas futuras
  desde: string | null; // null = sin limite
  hasta: string | null; // null = sin limite
  vendedor: string | null;
  modoFecha: ModoFecha; // columna del rango: fecha de venta o de facturacion
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

  for (const [nombre, valor] of [
    ['desde', desdeRaw],
    ['hasta', hastaRaw],
  ] as const) {
    if (valor && !fechaValida(valor)) return { error: `fecha ${nombre} inválida` };
  }

  // EXP-1: vacio = sin limite. El default de mes en curso lo decide el cliente
  // (filtrosIniciales) y se envia explicito, para que "limpiar fechas" sea posible.
  const desde = desdeRaw || null;
  const hasta = hastaRaw || null;
  if (desde && hasta && desde > hasta) return { error: 'rango de fechas inválido' };

  const modoFecha = parsearModoFecha(searchParams.get('modoFecha') ?? '');
  if (!modoFecha) return { error: 'modoFecha inválido' };

  const estadoParam = parsearEstado(searchParams.get('estado') ?? 'todas');
  if (!estadoParam) return { error: 'estado inválido' };
  let estado: EstadoNota | null = estadoParam === 'todas' ? null : estadoParam === 'pendientes' ? 'pendiente' : 'facturada';

  if (modoFecha === 'facturacion') {
    if (estado === 'pendiente') return { error: 'el modo facturación solo aplica a notas facturadas' };
    estado = 'facturada';
  }

  const limitRaw = searchParams.get('limit');
  let limit = 300;
  if (limitRaw !== null) {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1) return { error: 'limit inválido' };
    limit = Math.min(n, 500);
  }

  return {
    filtros: { hoy, desde, hasta, vendedor: searchParams.get('vendedor')?.trim() || null, modoFecha, estado, limit },
  };
}

const CLAVES_ACEPTADAS = [...CLAVES_FILTROS, ...CLAVES_LEGADO] as const;

/**
 * Valida y normaliza el JSON guardado por usuario. Acepta las claves del par de
 * visacion (formato anterior) y las migra sin abortar: el guardado viejo de un
 * usuario no debe romper la pantalla.
 */
export function validarFiltrosGuardados(raw: unknown): { filtros: FiltrosGuardados } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'filtros inválidos' };
  const obj = raw as Record<string, unknown>;
  for (const clave of Object.keys(obj)) {
    if (!(CLAVES_ACEPTADAS as readonly string[]).includes(clave)) {
      return { error: `clave desconocida: ${clave}` };
    }
  }

  const campos = {} as Record<(typeof CLAVES_ACEPTADAS)[number], string>;
  for (const clave of CLAVES_ACEPTADAS) {
    const valor = obj[clave] ?? '';
    if (typeof valor !== 'string') return { error: `${clave} inválido` };
    campos[clave] = valor.trim();
  }
  if (campos.vendedor.length > 100) return { error: 'vendedor inválido' };

  const modoFecha = parsearModoFecha(campos.modoFecha);
  if (!modoFecha) return { error: 'modoFecha inválido' };

  let { desde, hasta } = campos;
  let estado = campos.estado;
  let modo: ModoFecha = modoFecha;

  // Migracion A3: visa sin fechas de venta -> facturacion; con fechas -> se descarta.
  const tieneVisa = Boolean(campos.visaDesde || campos.visaHasta);
  if (tieneVisa && !desde && !hasta && fechaFiltroValida(campos.visaDesde) && fechaFiltroValida(campos.visaHasta)) {
    if (!(campos.visaDesde && campos.visaHasta && campos.visaDesde > campos.visaHasta)) {
      desde = campos.visaDesde;
      hasta = campos.visaHasta;
      estado = 'facturadas';
      modo = 'facturacion';
    }
  }

  for (const nombre of ['desde', 'hasta'] as const) {
    if (!fechaFiltroValida(campos[nombre])) return { error: `fecha ${nombre} inválida` };
  }
  if (desde && hasta && desde > hasta) return { error: 'rango de fechas inválido' };

  const empresa = empresasDe(campos.empresa)
    ? ((campos.empresa || 'todas') as FiltrosGuardados['empresa'])
    : null;
  if (!empresa) return { error: 'empresa inválida' };

  let estadoFiltro = parsearEstado(estado || 'todas');
  if (!estadoFiltro) return { error: 'estado inválido' };
  if (modo === 'facturacion') {
    if (estadoFiltro === 'pendientes') return { error: 'el modo facturación solo aplica a notas facturadas' };
    estadoFiltro = 'facturadas';
  }

  return {
    filtros: { vendedor: campos.vendedor, desde, hasta, estado: estadoFiltro, empresa, modoFecha: modo },
  };
}

/** Reglas del modulo (PRD B9), comunes a la tabla y al detalle. $1 = hoy. */
export function reglasModulo(esquema: EmpresaSlug): string {
  return `m.tipomovi='V'
    AND m.id_tdocu IN ('203','551','554')
    AND m.fechanvt <= $1::date
    AND btrim(COALESCE(m.vendedor,'')) <> ''
    AND btrim(upper(COALESCE(m.vendedor,''))) NOT IN ('PABLO BRAVO','EMPRESA')
    AND ((m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> '')
      OR (m.pestadot='1' AND btrim(COALESCE(m.visaadua,'')) = ''))
    AND EXISTS (SELECT 1 FROM ${esquema}.itemdcto i WHERE i.knumfoli = m.knumfoli)`;
}

// Columna del rango: SOLO desde este mapa fijo, nunca desde el texto del usuario.
const COLUMNA_FECHA: Record<ModoFecha, string> = { venta: 'm.fechanvt', facturacion: 'm.fechadoc' };

// Columnas de NotaVenta: solo cabecera, nunca costo/ganancia/precio.
function camposNota(esquema: EmpresaSlug): string {
  return `SELECT '${esquema}' AS empresa,
         m.knumfoli::text AS nota,
         to_char(m.fechanvt, 'YYYY-MM-DD') AS fecha_venta,
         COALESCE(m.cliente,'') AS cliente,
         btrim(COALESCE(m.vendedor,'')) AS vendedor,
         COALESCE(m.val_rea,0)::float8 AS total_usd,
         CASE WHEN m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> ''
              THEN 'facturada' ELSE 'pendiente' END AS estado,
         NULLIF(btrim(COALESCE(m.visaadua,'')),'') AS visacion,
         to_char(m.fechadoc, 'YYYY-MM-DD') AS fecha_facturacion`;
}

function bloqueNotas(esquema: EmpresaSlug, modoFecha: ModoFecha): string {
  const columna = COLUMNA_FECHA[modoFecha];
  return `
  ${camposNota(esquema)}
  FROM ${esquema}.movidcto m
  WHERE ${reglasModulo(esquema)}
    AND ($2::date IS NULL OR ${columna} >= $2::date)
    AND ($3::date IS NULL OR ${columna} <= $3::date)
    AND ($4::text IS NULL OR btrim(upper(m.vendedor)) = btrim(upper($4)))
    AND ($5::text IS NULL
      OR ($5='facturada' AND m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> '')
      OR ($5='pendiente' AND m.pestadot='1' AND btrim(COALESCE(m.visaadua,'')) = ''))`;
}

export function construirConsulta(
  empresas: EmpresaSlug[],
  filtros: FiltrosNotas
): { text: string; params: unknown[] } {
  const orden = filtros.modoFecha === 'facturacion' ? 'n.fecha_facturacion DESC NULLS LAST' : 'n.fecha_venta DESC';
  const text = `SELECT n.*, COUNT(*) OVER() AS total
FROM (${empresas.map((e) => bloqueNotas(e, filtros.modoFecha)).join('\n  UNION ALL\n')}) n
ORDER BY ${orden}, n.empresa, n.nota DESC
LIMIT $6`;
  return {
    text,
    params: [filtros.hoy, filtros.desde, filtros.hasta, filtros.vendedor, filtros.estado, filtros.limit],
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
  total?: unknown;
};

function mapearNotas(filas: FilaNota[]): NotaVenta[] {
  return filas.map((r) => {
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
}

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

  const notas = mapearNotas(filas);

  const vendedores = Array.from(new Set(listas.flat().map((v) => v.vendedor).filter(Boolean))).sort();

  return { notas, vendedores, total: Number(filas[0]?.total ?? 0) };
}

// Mismo plegado que el normalize('NFD') + toLowerCase() de normalizarBusqueda.
const TEXTO_CLIENTE =
  "translate(lower(COALESCE(m.cliente,'')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc')";

/** Trim + colapsar espacios + recorte a 60. El texto del usuario solo viaja como parametro. */
export function normalizarBusqueda(q: string): { patronNota: string | null; patronCliente: string } {
  const limpio = q.trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    patronNota: /^\d+$/.test(limpio) ? limpio.replace(/^0+/, '') || null : null,
    patronCliente: limpio
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[\\%_]/g, '\\$&'),
  };
}

function bloqueBusqueda(esquema: EmpresaSlug): string {
  return `
  ${camposNota(esquema)}
  FROM ${esquema}.movidcto m
  WHERE ${reglasModulo(esquema)}
    AND (($2::text IS NOT NULL AND ltrim(m.knumfoli::text,'0') LIKE ($2::text || '%'))
      OR ${TEXTO_CLIENTE} LIKE ('%' || $3::text || '%') ESCAPE '\\')`;
}

/** Buscador: mira siempre vida+sanjh, ignora rango de fechas/estado de la tabla. */
export function construirConsultaBusqueda(
  q: string,
  hoy: string,
  limit = 8
): { text: string; params: unknown[] } {
  const { patronNota, patronCliente } = normalizarBusqueda(q);
  const text = `SELECT n.*
FROM (${(['vida', 'sanjh'] as EmpresaSlug[]).map(bloqueBusqueda).join('\n  UNION ALL\n')}) n
ORDER BY n.fecha_venta DESC, n.empresa, n.nota DESC
LIMIT $4`;
  return { text, params: [hoy, patronNota, patronCliente, limit] };
}

export async function buscarNotas(q: string, hoy: string): Promise<{ notas: NotaVenta[] }> {
  const { text, params } = construirConsultaBusqueda(q, hoy);
  const filas = (await sql.query(text, params)) as unknown as FilaNota[];
  return { notas: mapearNotas(filas ?? []) };
}

type FilaDetalle = {
  nota: string; fecha_venta: string; estado: string; total_usd: unknown;
  cliente: string | null; cliente_factura: string | null; vendedor: string | null;
  visacion: string | null; fecha_visacion: string | null;
};

type FilaLineaDetalle = {
  codigo: string | null; costo: unknown; precio: unknown; unidades: unknown;
  cajas: unknown; total_linea: unknown; imagen_url: string | null;
};

export function construirConsultaDetalle(esquema: EmpresaSlug): { cabecera: string; lineas: string } {
  const empresaId = esquema === 'sanjh' ? 1 : 2; // vida=2, sanjh=1
  return {
    cabecera: `SELECT m.knumfoli::text AS nota,
       to_char(m.fechanvt, 'YYYY-MM-DD') AS fecha_venta,
       COALESCE(m.cliente,'') AS cliente,
       COALESCE(m.factura,'') AS cliente_factura,
       btrim(COALESCE(m.vendedor,'')) AS vendedor,
       COALESCE(m.val_rea,0)::float8 AS total_usd,
       CASE WHEN m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> ''
            THEN 'facturada' ELSE 'pendiente' END AS estado,
       NULLIF(btrim(COALESCE(m.visaadua,'')),'') AS visacion,
       to_char(m.fechadoc, 'YYYY-MM-DD') AS fecha_visacion
FROM ${esquema}.movidcto m
WHERE ${reglasModulo(esquema)}
  AND m.knumfoli = $2
LIMIT 1`,
    // La imagen se trae con LATERAL + LIMIT 1: productos tiene una fila por
    // ingreso y un JOIN normal multiplicaria las lineas.
    lineas: `SELECT COALESCE(btrim(i.codunico),'') AS codigo,
       COALESCE(i.cosunita,0)::float8 AS costo,
       COALESCE(i.precread,0)::float8 AS precio,
       COALESCE(i.cantsali,0)::float8 AS unidades,
       COALESCE(i.tcancaja,0)::float8 AS cajas,
       COALESCE(i.totalrea, i.precread*i.cantsali)::float8 AS total_linea,
       img.imagen_url AS imagen_url
FROM ${esquema}.itemdcto i
LEFT JOIN LATERAL (
  SELECT p.imagen_url
  FROM public.productos p
  WHERE p.codigo = i.codunico
    AND p.empresa_id = ${empresaId}
    AND p.imagen_url IS NOT NULL
  ORDER BY p.fecha_ingreso DESC NULLS LAST, p.id DESC
  LIMIT 1
) img ON true
WHERE i.knumfoli = $1
ORDER BY i.kdocitem, i.codunico`,
  };
}

/** Detalle de una nota del modulo. null = no existe para el modulo (404). */
export async function fetchDetalleNota(
  esquema: EmpresaSlug,
  nota: string,
  hoy: string
): Promise<DetalleNota | null> {
  const { cabecera, lineas } = construirConsultaDetalle(esquema);
  const filas = (await sql.query(cabecera, [hoy, nota])) as unknown as FilaDetalle[];
  const cab = filas?.[0];
  if (!cab) return null;

  const filasLineas = (await sql.query(lineas, [nota])) as unknown as FilaLineaDetalle[];
  const lineasMapeadas: LineaDetalle[] = (filasLineas ?? []).map((r) => ({
    codigo: r.codigo ?? '', costo: Number(r.costo) || 0, precio: Number(r.precio) || 0,
    cajas: Number(r.cajas) || 0, unidades: Number(r.unidades) || 0,
    total_linea: Number(r.total_linea) || 0, imagen_url: r.imagen_url ?? null,
  }));

  const total = Number(cab.total_usd) || 0;
  return {
    empresa: esquema, empresa_nombre: NOMBRE_EMPRESA[esquema],
    nota: String(cab.nota), fecha_venta: String(cab.fecha_venta),
    cliente: cab.cliente ?? '', cliente_factura: cab.cliente_factura ?? '',
    vendedor: cab.vendedor ?? '', total_usd: total,
    estado: cab.estado === 'facturada' ? 'facturada' : 'pendiente',
    visacion: cab.visacion ?? null, fecha_visacion: cab.fecha_visacion ?? null,
    lineas: lineasMapeadas, diferencia_usd: diferenciaNota(total, sumaLineas(lineasMapeadas)),
  };
}
