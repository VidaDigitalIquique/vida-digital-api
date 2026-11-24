import fs from 'fs';
import path from 'path';

// Guarda estructural de D10: las listas de roles viven solo en lib/roles.ts.
// Se lee el fuente como texto para no importar cada route.ts (mocks/entorno Next).
const raiz = path.join(__dirname, '..');
const leer = (rel: string) => fs.readFileSync(path.join(raiz, rel), 'utf8');

const CASOS: Array<[string, string]> = [
  // Lista admin/supervisor/vendedor -> ROLES_OPERATIVOS (ROLES_ALERTAS para las de alertas).
  ['app/api/admin/sync-from-winfac/route.ts', 'ROLES_OPERATIVOS'],
  ['app/api/admin/trigger-sync/route.ts', 'ROLES_OPERATIVOS'],
  ['app/api/alertas-stock/lista/route.ts', 'ROLES_ALERTAS'],
  ['app/api/alertas-stock/[id]/route.ts', 'ROLES_ALERTAS'],
  ['app/api/alertas-stock/route.ts', 'ROLES_ALERTAS'],
  ['app/api/clientes-deseados/route.ts', 'ROLES_OPERATIVOS'],
  ['app/api/clientes-deseados/[id]/route.ts', 'ROLES_OPERATIVOS'],
  ['app/api/deseados/route.ts', 'ROLES_OPERATIVOS'],
  ['app/api/deseados/alertas/route.ts', 'ROLES_ALERTAS'],
  ['app/api/deseados/upload/route.ts', 'ROLES_OPERATIVOS'],
  ['app/api/deseados/[id]/route.ts', 'ROLES_OPERATIVOS'],
  // Lista admin/vendedor.
  ['app/api/seguimientos/alertas/route.ts', 'ROLES_SEGUIMIENTOS'],
  ['app/api/catalog-image/generate/route.ts', 'ROLES_CATALOGO'],
];

describe('fuente unica de roles en APIs', () => {
  it.each(CASOS)('%s importa %s y no repite la lista literal', (rel, constante) => {
    const src = leer(rel);
    expect(src).toContain(`import { ${constante} } from '@/lib/roles';`);
    expect(src).not.toMatch(/\[['"]admin['"]/);
    expect(src).not.toMatch(/\[['"]supervisor['"]/);
  });

  it('AlertasContext importa las listas compartidas', () => {
    const src = leer('contexts/AlertasContext.tsx');
    expect(src).toContain("import { ROLES_ALERTAS, ROLES_SEGUIMIENTOS } from '@/lib/roles';");
    expect(src).not.toMatch(/const ROLES_ALERTAS/);
    expect(src).not.toMatch(/const ROLES_SEGUIMIENTOS/);
  });
});
