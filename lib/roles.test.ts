/**
 * D1 — control de acceso a catalogos.
 * Estado inicial: ROJO (lib/roles.ts aun no existe).
 */
import { ROLES_CATALOGO, puedeGestionarCatalogos } from './roles';

describe('puedeGestionarCatalogos', () => {
  it('ROLES_CATALOGO contiene admin y vendedor', () => {
    expect(ROLES_CATALOGO).toEqual(['admin', 'vendedor']);
  });

  it('admin -> true', () => {
    expect(puedeGestionarCatalogos('admin')).toBe(true);
  });

  it('vendedor -> true', () => {
    expect(puedeGestionarCatalogos('vendedor')).toBe(true);
  });

  it.each(['bodeguero', '', 'Admin', 'ADMIN', 'root'])('%p -> false', (rol) => {
    expect(puedeGestionarCatalogos(rol)).toBe(false);
  });

  it.each([undefined, null, 123, true, {}, []])('%p (no string) -> false', (rol) => {
    expect(puedeGestionarCatalogos(rol)).toBe(false);
  });
});
