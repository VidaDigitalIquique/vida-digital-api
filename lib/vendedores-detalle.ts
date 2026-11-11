/**
 * Detalle de una nota de venta: tipos y calculos puros.
 * Client-safe a proposito: NO importa lib/db (lo usa el modal de S4b).
 */
export interface LineaDetalle {
  codigo: string;
  costo: number;
  precio: number;
  cajas: number;
  unidades: number;
  total_linea: number; // itemdcto.totalrea (fallback precread*cantsali)
  imagen_url: string | null;
}

export interface DetalleNota {
  empresa: 'vida' | 'sanjh';
  empresa_nombre: string;
  nota: string;
  fecha_venta: string;
  cliente: string;
  cliente_factura: string;
  vendedor: string;
  total_usd: number;
  estado: 'facturada' | 'pendiente';
  visacion: string | null;
  fecha_visacion: string | null;
  lineas: LineaDetalle[];
  diferencia_usd: number | null;
}

// Costo 0 o invalido -> null (nunca Infinity/NaN).
export function porcentajeSobreCosto(precio: number, costo: number): number | null {
  if (!Number.isFinite(precio) || !Number.isFinite(costo) || costo <= 0) return null;
  return ((precio - costo) / costo) * 100;
}

// Sin redondear: el redondeo es solo al mostrar.
export function gananciaLinea(precio: number, costo: number, unidades: number): number {
  return (precio - costo) * unidades;
}

// Suma para el aviso D13/D14: usa totalrea (no precio*unidades).
export function sumaLineas(lineas: LineaDetalle[]): number {
  return lineas.reduce((s, l) => s + l.total_linea, 0);
}

export function totalGanancia(lineas: LineaDetalle[]): number {
  return lineas.reduce((s, l) => s + gananciaLinea(l.precio, l.costo, l.unidades), 0);
}

// Diferencia lineas - val_rea; null si |diferencia| <= 0,01 (tolerancia PRD).
export function diferenciaNota(totalUsd: number, suma: number): number | null {
  const diferencia = suma - totalUsd;
  return Math.abs(diferencia) > 0.01 ? diferencia : null;
}
