export const ROLES_CATALOGO = ['admin', 'vendedor'];

export function puedeGestionarCatalogos(rol: unknown): boolean {
  return typeof rol === 'string' && ROLES_CATALOGO.includes(rol);
}

/** Modulo VENDEDORES: solo admin (PRD R3). */
export function puedeVerVendedores(rol: unknown): boolean {
  return rol === 'admin';
}
