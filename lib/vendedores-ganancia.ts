import { sql } from '@/lib/db';
import { fechaDiaCL } from '@/lib/fechas';
import { redondearCentavos } from '@/lib/comisiones-utils';
import { reglasModulo, type EmpresaSlug } from '@/lib/vendedores-notas';
import type { Agrupacion, EstadoGanancia, FilaGanancia, InformeGanancia } from '@/lib/vendedores-ganancia-tipos';

export type { Agrupacion, EstadoGanancia, FilaGanancia, InformeGanancia };

export const MAX_PERIODOS = 400;

const EMPRESAS: EmpresaSlug[] = ['vida', 'sanjh'];

// Expresion de agrupacion: mapa fijo, nunca texto del usuario.
const EXPR: Record<Agrupacion, string> = {
  dia: `to_char(date_trunc('day', g.fechanvt), 'YYYY-MM-DD')`,
  semana: `to_char(date_trunc('week', g.fechanvt), 'YYYY-MM-DD')`,
  mes: `to_char(date_trunc('month', g.fechanvt), 'YYYY-MM')`,
  anio: `to_char(date_trunc('year', g.fechanvt), 'YYYY')`,
};

export function parsearAgrupacion(valor: string | null): Agrupacion | null {
  return valor === 'dia' || valor === 'semana' || valor === 'mes' || valor === 'anio' ? valor : null;
}

/** Defaults a partir de una fecha de Chile ya calculada (hoyCL): nunca la TZ del proceso. */
export function rangoPorDefecto(agrupacion: Agrupacion, hoy: string): { desde: string; hasta: string } {
  const anio = Number(hoy.slice(0, 4));
  if (agrupacion === 'dia') return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  if (agrupacion === 'anio') return { desde: `${anio - 4}-01-01`, hasta: hoy };
  return { desde: `${anio}-01-01`, hasta: hoy };
}

/** Etiqueta pura: no usa Date ni zona horaria. */
export function etiquetaPeriodo(agrupacion: Agrupacion, periodo: string): string {
  if (agrupacion === 'dia') return fechaDiaCL(periodo);
  if (agrupacion === 'semana') return `Sem. ${fechaDiaCL(periodo)} (lun)`;
  return periodo;
}

function estadoSql(estado: EstadoGanancia): string | null {
  return estado === 'facturadas' ? 'facturada' : estado === 'pendientes' ? 'pendiente' : null;
}

/**
 * Ganancia por periodo de una empresa. Reglas del modulo con $1 = hoy.
 * D14: 1:N intencional con itemdcto; se agrega por nota antes de agrupar y no
 * se une public.productos (una fila por ingreso multiplicaria las lineas).
 */
export function consultaGanancia(
  esquema: EmpresaSlug,
  agrupacion: Agrupacion,
  estado: EstadoGanancia,
  desde: string,
  hasta: string,
  hoy: string
): { text: string; params: unknown[] } {
  const text = `SELECT ${EXPR[agrupacion]} AS periodo,
       COALESCE(SUM(g.ganancia), 0)::float8 AS total_usd
FROM (
  SELECT m.knumfoli, m.fechanvt,
         SUM((COALESCE(i.precread,0) - COALESCE(i.cosunita,0)) * COALESCE(i.cantsali,0)) AS ganancia
  FROM ${esquema}.movidcto m
  JOIN ${esquema}.itemdcto i ON i.knumfoli = m.knumfoli
  WHERE ${reglasModulo(esquema)}
    AND m.fechanvt >= $2::date
    AND m.fechanvt <= $3::date
    AND ($4::text IS NULL
      OR ($4='facturada' AND m.pestadot='3' AND btrim(COALESCE(m.visaadua,'')) <> '')
      OR ($4='pendiente' AND m.pestadot='1' AND btrim(COALESCE(m.visaadua,'')) = ''))
  GROUP BY m.knumfoli, m.fechanvt
) g
GROUP BY 1`;
  return { text, params: [hoy, desde, hasta, estadoSql(estado)] };
}

type FilaPeriodo = { periodo: string; total_usd: unknown };

/** Informe del rango: una query por empresa en paralelo, mezcla y redondeo por moneda. */
export async function fetchGanancia(
  agrupacion: Agrupacion,
  desde: string,
  hasta: string,
  estado: EstadoGanancia,
  hoy: string
): Promise<InformeGanancia> {
  const resultados = await Promise.all(
    EMPRESAS.map((e) => {
      const { text, params } = consultaGanancia(e, agrupacion, estado, desde, hasta, hoy);
      return sql.query(text, params);
    })
  );

  const acumulado = new Map<string, { vida: number; sanjh: number }>();
  EMPRESAS.forEach((empresa, idx) => {
    for (const r of (resultados[idx] ?? []) as unknown as FilaPeriodo[]) {
      const periodo = String(r.periodo);
      const fila = acumulado.get(periodo) ?? { vida: 0, sanjh: 0 };
      fila[empresa] += Number(r.total_usd) || 0; // null/NaN -> 0
      acumulado.set(periodo, fila);
    }
  });

  const periodos = Array.from(acumulado.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const truncado = periodos.length > MAX_PERIODOS;
  const filas: FilaGanancia[] = periodos.slice(0, MAX_PERIODOS).map((periodo) => {
    const { vida, sanjh } = acumulado.get(periodo)!;
    const vidaUsd = redondearCentavos(vida);
    const sanjhUsd = redondearCentavos(sanjh);
    return {
      periodo,
      etiqueta: etiquetaPeriodo(agrupacion, periodo),
      vida_usd: vidaUsd,
      sanjh_usd: sanjhUsd,
      total_usd: redondearCentavos(vidaUsd + sanjhUsd), // Vida + SANJH = Total fila por fila
    };
  });
  const suma = (campo: 'vida_usd' | 'sanjh_usd' | 'total_usd') => filas.reduce((s, f) => s + f[campo], 0);

  return {
    agrupacion,
    desde,
    hasta,
    estado,
    filas,
    totales: {
      vida_usd: redondearCentavos(suma('vida_usd')),
      sanjh_usd: redondearCentavos(suma('sanjh_usd')),
      total_usd: redondearCentavos(suma('total_usd')),
    },
    truncado,
  };
}
