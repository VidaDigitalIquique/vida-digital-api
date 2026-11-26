// Validacion pura de los filtros de VENDEDORES: sin imports de servidor, para
// poder usarla tambien en el cliente (EXP-3) sin arrastrar lib/db.

export type EmpresaFiltro = 'todas' | 'vida' | 'sanjh';
export type EstadoFiltro = 'todas' | 'pendientes' | 'facturadas';
export type ModoFecha = 'venta' | 'facturacion';

export interface FiltrosGuardados {
  vendedor: string;
  desde: string;
  hasta: string;
  estado: EstadoFiltro;
  empresa: EmpresaFiltro;
  modoFecha: ModoFecha;
}

export const CLAVES_FILTROS = ['vendedor', 'desde', 'hasta', 'estado', 'empresa', 'modoFecha'] as const;

/** Claves del formato anterior (par de visacion): solo se leen para migrar. */
export const CLAVES_LEGADO = ['visaDesde', 'visaHasta'] as const;

export function fechaValida(valor: string | null): boolean {
  if (valor === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const t = Date.parse(`${valor}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === valor;
}

/** Para los campos del cliente: vacio = sin filtro; exige anio 2000-2100. */
export function fechaFiltroValida(valor: string): boolean {
  if (!valor) return true;
  const anio = Number(valor.slice(0, 4));
  return fechaValida(valor) && anio >= 2000 && anio <= 2100;
}

export function parsearEstado(valor: string): EstadoFiltro | null {
  if (valor === 'todas' || valor === 'pendientes' || valor === 'facturadas') return valor;
  return null;
}

/** Vacio = fila del formato viejo sin modo: se trata como venta. */
export function parsearModoFecha(valor: string): ModoFecha | null {
  if (valor === '' || valor === 'venta') return 'venta';
  if (valor === 'facturacion') return 'facturacion';
  return null;
}
