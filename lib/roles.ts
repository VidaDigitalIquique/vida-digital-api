export const ROLES_CATALOGO = ['admin', 'vendedor'];

/** APIs operativas (deseados, clientes-deseados, alertas de stock, sync): admin, supervisor y vendedor. */
export const ROLES_OPERATIVOS = ['admin', 'supervisor', 'vendedor'];

/** Alertas de deseados y de stock bajo: misma lista que las APIs operativas. */
export const ROLES_ALERTAS = ROLES_OPERATIVOS;

/** Alertas de seguimientos: admin y vendedor. */
export const ROLES_SEGUIMIENTOS = ['admin', 'vendedor'];

export function puedeGestionarCatalogos(rol: unknown): boolean {
  return typeof rol === 'string' && ROLES_CATALOGO.includes(rol);
}

/** Modulo VENDEDORES (notas, filtros, comisiones): admin y vendedor. */
export function puedeVerVendedores(rol: unknown): boolean {
  return typeof rol === 'string' && (rol === 'admin' || rol === 'vendedor');
}

/** Ganancia por periodo y detalle de nota (costo, % sobre costo): solo admin. */
export function puedeVerGananciaVendedores(rol: unknown): boolean {
  return rol === 'admin';
}

/** Editar el %global de comision: solo admin (C1). */
export function puedeEditarComisionPct(rol: unknown): boolean {
  return rol === 'admin';
}
