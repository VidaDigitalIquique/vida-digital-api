// Tipos client-safe del informe de ganancia: S7c-2 los importa sin arrastrar lib/db.

export type Agrupacion = 'dia' | 'semana' | 'mes' | 'anio';
export type EstadoGanancia = 'todas' | 'pendientes' | 'facturadas';

export interface FilaGanancia {
  periodo: string; // dia/semana: "YYYY-MM-DD" (lunes) · mes: "YYYY-MM" · anio: "YYYY"
  etiqueta: string; // dia "24-11-2026" · semana "Sem. 24-11-2026 (lun)" · mes/anio = periodo
  vida_usd: number;
  sanjh_usd: number;
  total_usd: number;
}

export interface InformeGanancia {
  agrupacion: Agrupacion;
  desde: string;
  hasta: string;
  estado: EstadoGanancia;
  filas: FilaGanancia[];
  totales: { vida_usd: number; sanjh_usd: number; total_usd: number };
  truncado: boolean;
}

// Cuenta los periodos que toca el rango (ambos extremos inclusive) sin consultar
// la base: cota previa para el tope de 400 (S10a).
export function periodosEnRango(agrupacion: Agrupacion, desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  if (agrupacion === 'dia') return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000) + 1;
  if (agrupacion === 'semana') return Math.floor((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 604800000) + 1;
  if (agrupacion === 'mes') return (a2 - a1) * 12 + (m2 - m1) + 1;
  return a2 - a1 + 1;
}
