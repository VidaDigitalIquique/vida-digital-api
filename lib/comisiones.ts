import { sql } from '@/lib/db';
import { consultaVendedores, reglasModulo, type EmpresaSlug } from '@/lib/vendedores-notas';
import { etiquetaMes, rangoMes, redondearCentavos, type FilaComision, type InformeComisiones } from '@/lib/comisiones-utils';

const EMPRESAS: EmpresaSlug[] = ['vida', 'sanjh'];
type FilaAgregado = { vendedor: string | null; notas: unknown; total_usd: unknown };
type FilaVendedor = { vendedor: string | null };

/** Facturadas del mes por vendedor. Reglas del modulo con $1 = hoy (igual que la tabla). */
export function consultaComisiones(esquema: EmpresaSlug): string {
  return `SELECT btrim(m.vendedor) AS vendedor,
       COUNT(*)::int AS notas,
       COALESCE(SUM(m.val_rea), 0)::float8 AS total_usd
FROM ${esquema}.movidcto m
WHERE ${reglasModulo(esquema)}
  AND m.pestadot = '3'
  AND btrim(COALESCE(m.visaadua, '')) <> ''
  AND m.fechadoc >= $2::date
  AND m.fechadoc <  $3::date
GROUP BY 1`;
}

/**
 * Informe del mes ya calculado (S6 exporta estas mismas filas sin recalcular).
 * Una fila por vendedor valido del modulo (consultaVendedores), ambas empresas
 * sumadas; los agregados de un vendedor fuera de la lista se descartan.
 */
export async function fetchComisiones(mes: string, hoy: string, comisionPct: number): Promise<InformeComisiones> {
  const { desde, hasta } = rangoMes(mes);
  const [agregadosRaw, listasRaw] = await Promise.all([
    Promise.all(EMPRESAS.map((e) => sql.query(consultaComisiones(e), [hoy, desde, hasta]))),
    Promise.all(EMPRESAS.map((e) => sql.query(consultaVendedores(e), [hoy]))),
  ]);
  const agregados = (agregadosRaw ?? []).flat() as unknown as FilaAgregado[];
  const listas = (listasRaw ?? []).flat() as unknown as FilaVendedor[];

  const acumulado = new Map<string, { vendedor: string; notas: number; total: number }>();
  for (const r of listas) {
    const nombre = (r.vendedor ?? '').trim();
    if (nombre && !acumulado.has(nombre.toUpperCase())) {
      // El filtro de la tabla compara con upper(): deduplicar igual.
      acumulado.set(nombre.toUpperCase(), { vendedor: nombre, notas: 0, total: 0 });
    }
  }
  for (const r of agregados) {
    const fila = acumulado.get((r.vendedor ?? '').trim().toUpperCase());
    if (!fila) continue;
    fila.notas += Number(r.notas) || 0;
    fila.total += Number(r.total_usd) || 0;
  }

  // Comparacion simple: localeCompare depende del ICU del proceso.
  const filas: FilaComision[] = Array.from(acumulado.values())
    .sort((a, b) => (a.vendedor < b.vendedor ? -1 : a.vendedor > b.vendedor ? 1 : 0))
    .map((f) => {
      const total = redondearCentavos(f.total);
      return { vendedor: f.vendedor, notas: f.notas, total_usd: total, comision_pct: comisionPct, comision_usd: redondearCentavos((total * comisionPct) / 100) };
    });
  const suma = (campo: 'notas' | 'total_usd' | 'comision_usd') => filas.reduce((s, f) => s + f[campo], 0);

  return {
    mes,
    mes_etiqueta: etiquetaMes(mes),
    comision_pct: comisionPct,
    filas,
    totales: {
      notas: suma('notas'),
      total_usd: redondearCentavos(suma('total_usd')),
      comision_usd: redondearCentavos(suma('comision_usd')),
    },
  };
}

/** % configurado; sin fila se usa 0,5 (una tabla inexistente debe fallar ruidosa). */
export async function leerComisionPct(): Promise<number> {
  const filas = (await sql.query('SELECT comision_pct::float8 AS pct FROM public.vendedores_config WHERE id = 1', [])) as unknown as Array<{ pct: unknown }>;
  const pct = Number(filas?.[0]?.pct);
  return Number.isFinite(pct) ? pct : 0.5;
}
