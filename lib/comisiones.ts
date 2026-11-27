import { sql } from '@/lib/db';
import { consultaVendedores, reglasModulo, type EmpresaSlug } from '@/lib/vendedores-notas';
import { etiquetaMes, margenSobreCosto, rangoMes, redondearCentavos, type FilaComision, type InformeComisiones } from '@/lib/comisiones-utils';

const EMPRESAS: EmpresaSlug[] = ['vida', 'sanjh'];
type FilaAgregado = { vendedor: string | null; notas: unknown; total_usd: unknown };
type FilaMargen = { vendedor: string | null; ganancia_usd: unknown; costo_usd: unknown };
type FilaVendedor = { vendedor: string | null };

/** Condiciones de la nota del mes compartidas por comisiones y margen ($2..$3 = rango). */
function condicionesComisionesMes(esquema: EmpresaSlug): string {
  return `${reglasModulo(esquema)}
  AND m.pestadot = '3'
  AND btrim(COALESCE(m.visaadua, '')) <> ''
  AND m.fechadoc >= $2::date
  AND m.fechadoc <  $3::date`;
}

/** Facturadas del mes por vendedor. Reglas del modulo con $1 = hoy (igual que la tabla). */
export function consultaComisiones(esquema: EmpresaSlug): string {
  return `SELECT btrim(m.vendedor) AS vendedor,
       COUNT(*)::int AS notas,
       COALESCE(SUM(m.val_rea), 0)::float8 AS total_usd
FROM ${esquema}.movidcto m
WHERE ${condicionesComisionesMes(esquema)}
GROUP BY 1`;
}

/**
 * Ganancia y costo crudos por vendedor, desde las lineas de la nota (solo admin, s16).
 * Sin la linea sin costo valido en NINGUNA de las dos sumas (D13: inflaria el margen).
 */
export function consultaMargenComisiones(esquema: EmpresaSlug): string {
  return `SELECT btrim(m.vendedor) AS vendedor,
       COALESCE(SUM((COALESCE(i.precread,0) - COALESCE(i.cosunita,0)) * COALESCE(i.cantsali,0)), 0)::float8 AS ganancia_usd,
       COALESCE(SUM(COALESCE(i.cosunita,0) * COALESCE(i.cantsali,0)), 0)::float8 AS costo_usd
FROM ${esquema}.movidcto m
JOIN ${esquema}.itemdcto i ON i.knumfoli = m.knumfoli
WHERE ${condicionesComisionesMes(esquema)}
  AND COALESCE(i.cosunita,0) > 0
GROUP BY 1`;
}

/**
 * Informe del mes ya calculado (S6 exporta estas mismas filas sin recalcular).
 * Una fila por vendedor valido del modulo (consultaVendedores), ambas empresas
 * sumadas; los agregados de un vendedor fuera de la lista se descartan.
 */
export async function fetchComisiones(
  mes: string,
  hoy: string,
  comisionPct: number,
  verMargen = false
): Promise<InformeComisiones> {
  const { desde, hasta } = rangoMes(mes);
  const [agregadosRaw, listasRaw, margenesRaw] = await Promise.all([
    Promise.all(EMPRESAS.map((e) => sql.query(consultaComisiones(e), [hoy, desde, hasta]))),
    Promise.all(EMPRESAS.map((e) => sql.query(consultaVendedores(e), [hoy]))),
    verMargen
      ? Promise.all(EMPRESAS.map((e) => sql.query(consultaMargenComisiones(e), [hoy, desde, hasta])))
      : [],
  ]);
  const agregados = (agregadosRaw ?? []).flat() as unknown as FilaAgregado[];
  const listas = (listasRaw ?? []).flat() as unknown as FilaVendedor[];
  const margenes = (margenesRaw ?? []).flat() as unknown as FilaMargen[];

  const acumulado = new Map<string, { vendedor: string; notas: number; total: number; ganancia: number; costo: number }>();
  for (const r of listas) {
    const nombre = (r.vendedor ?? '').trim();
    if (nombre && !acumulado.has(nombre.toUpperCase())) {
      // El filtro de la tabla compara con upper(): deduplicar igual.
      acumulado.set(nombre.toUpperCase(), { vendedor: nombre, notas: 0, total: 0, ganancia: 0, costo: 0 });
    }
  }
  for (const r of agregados) {
    const fila = acumulado.get((r.vendedor ?? '').trim().toUpperCase());
    if (!fila) continue;
    fila.notas += Number(r.notas) || 0;
    fila.total += Number(r.total_usd) || 0;
  }
  // Se acumula crudo por empresa y se divide UNA vez por vendedor (no promedio de %).
  for (const r of margenes) {
    const fila = acumulado.get((r.vendedor ?? '').trim().toUpperCase());
    if (!fila) continue;
    fila.ganancia += Number(r.ganancia_usd) || 0;
    fila.costo += Number(r.costo_usd) || 0;
  }

  // Comparacion simple: localeCompare depende del ICU del proceso.
  const acumulados = Array.from(acumulado.values()).sort((a, b) =>
    a.vendedor < b.vendedor ? -1 : a.vendedor > b.vendedor ? 1 : 0
  );
  const filas: FilaComision[] = acumulados.map((f) => {
    const total = redondearCentavos(f.total);
    const fila: FilaComision = { vendedor: f.vendedor, notas: f.notas, total_usd: total, comision_pct: comisionPct, comision_usd: redondearCentavos((total * comisionPct) / 100) };
    if (verMargen) fila.margen_pct = margenSobreCosto(f.ganancia, f.costo);
    return fila;
  });
  const suma = (campo: 'notas' | 'total_usd' | 'comision_usd') => filas.reduce((s, f) => s + f[campo], 0);
  const ganancia = acumulados.reduce((s, f) => s + f.ganancia, 0);
  const costo = acumulados.reduce((s, f) => s + f.costo, 0);

  return {
    mes,
    mes_etiqueta: etiquetaMes(mes),
    comision_pct: comisionPct,
    filas,
    totales: {
      notas: suma('notas'),
      total_usd: redondearCentavos(suma('total_usd')),
      comision_usd: redondearCentavos(suma('comision_usd')),
      ...(verMargen ? { margen_pct: margenSobreCosto(ganancia, costo) } : {}),
    },
  };
}

/** % configurado; sin fila se usa 0,5 (una tabla inexistente debe fallar ruidosa). */
export async function leerComisionPct(): Promise<number> {
  const filas = (await sql.query('SELECT comision_pct::float8 AS pct FROM public.vendedores_config WHERE id = 1', [])) as unknown as Array<{ pct: unknown }>;
  const pct = Number(filas?.[0]?.pct);
  return Number.isFinite(pct) ? pct : 0.5;
}

/** Guarda el % en la fila unica (id fijo 1: no puede duplicarse) y lo devuelve. */
export async function guardarComisionPct(pct: number, usuarioId: number): Promise<number> {
  const filas = (await sql.query(
    `INSERT INTO public.vendedores_config (id, comision_pct, updated_at, updated_by)
     VALUES (1, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE
       SET comision_pct = EXCLUDED.comision_pct, updated_at = now(), updated_by = EXCLUDED.updated_by
     RETURNING comision_pct::float8 AS pct`,
    [pct, usuarioId]
  )) as unknown as Array<{ pct: unknown }>;
  const guardado = Number(filas?.[0]?.pct);
  return Number.isFinite(guardado) ? guardado : pct;
}
