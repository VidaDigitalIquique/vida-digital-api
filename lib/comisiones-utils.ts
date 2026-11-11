/**
 * Calculos y validacion puros del informe de comisiones: sin imports de servidor,
 * para poder usarlos tambien en el cliente (ComisionesPanel, S5b).
 */

export interface FilaComision {
  vendedor: string;
  notas: number;
  total_usd: number;
  comision_pct: number;
  comision_usd: number;
}

export interface InformeComisiones {
  mes: string; // YYYY-MM
  mes_etiqueta: string; // "noviembre 2026"
  comision_pct: number;
  filas: FilaComision[];
  totales: { notas: number; total_usd: number; comision_usd: number };
}

// Nombres fijos: el ICU de Node dice "sept" en septiembre (misma razon que lib/fechas.ts).
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** YYYY-MM valido (anio 2000-2100) o null. */
export function mesValido(valor: string | null): string | null {
  if (!valor || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return null;
  const anio = Number(valor.slice(0, 4));
  return anio >= 2000 && anio <= 2100 ? valor : null;
}

/** Mes en curso a partir de una fecha de Chile ya calculada (hoyCL). */
export function mesDeHoy(hoy: string): string {
  return hoy.slice(0, 7);
}

/** Primer dia del mes y primer dia del mes siguiente (limite superior exclusivo). */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split('-').map(Number);
  const siguiente = m === 12 ? `${anio + 1}-01-01` : `${anio}-${String(m + 1).padStart(2, '0')}-01`;
  return { desde: `${mes}-01`, hasta: siguiente };
}

export function etiquetaMes(mes: string): string {
  const nombre = MESES[Number(mes.slice(5, 7)) - 1];
  return nombre ? `${nombre} ${mes.slice(0, 4)}` : mes;
}

/** Numero entre 0 y 100 con maximo 2 decimales, normalizado; null si no sirve. */
export function validarPct(valor: unknown): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 100) return null;
  if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-9) return null;
  return Math.round(valor * 100) / 100;
}

/** Half-up a centavos, quitando antes el ruido binario de los float8. */
export function redondearCentavos(n: number): number {
  return Math.round(Number((n * 100).toFixed(6))) / 100;
}
