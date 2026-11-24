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

/** Modulo VENDEDORES: solo admin (PRD R3). */
export function puedeVerVendedores(rol: unknown): boolean {
  return rol === 'admin';
}
