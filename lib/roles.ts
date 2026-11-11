export const ROLES_CATALOGO = ['admin', 'vendedor'];

export function puedeGestionarCatalogos(rol: unknown): boolean {
  return typeof rol === 'string' && ROLES_CATALOGO.includes(rol);
}
