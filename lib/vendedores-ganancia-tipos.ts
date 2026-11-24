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
