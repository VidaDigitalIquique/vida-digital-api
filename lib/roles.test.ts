/**
 * D1 — control de acceso a catalogos.
 * Estado inicial: ROJO (lib/roles.ts aun no existe).
 */
import { ROLES_ALERTAS, ROLES_CATALOGO, ROLES_SEGUIMIENTOS, puedeGestionarCatalogos, puedeVerVendedores } from './roles';

describe('listas de roles compartidas (fuente unica)', () => {
  it('ROLES_ALERTAS es la lista de las APIs de alertas', () => {
    expect(ROLES_ALERTAS).toEqual(['admin', 'supervisor', 'vendedor']);
  });

  it('ROLES_SEGUIMIENTOS es la lista de la API de seguimientos', () => {
    expect(ROLES_SEGUIMIENTOS).toEqual(['admin', 'vendedor']);
  });
});

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

describe('puedeVerVendedores', () => {
  it('admin -> true', () => {
    expect(puedeVerVendedores('admin')).toBe(true);
  });

  it.each(['vendedor', 'bodeguero', 'supervisor', '', 'Admin', 'ADMIN', 'root'])(
    '%p -> false',
    (rol) => {
      expect(puedeVerVendedores(rol)).toBe(false);
    }
  );

  it.each([undefined, null, 123, true, {}, []])('%p (no string) -> false', (rol) => {
    expect(puedeVerVendedores(rol)).toBe(false);
  });
});
