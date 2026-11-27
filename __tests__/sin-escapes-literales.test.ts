/**
 * @jest-environment node
 *
 * Guardia permanente (s20): en plantillas de texto (backticks) un `\${` deja la
 * interpolación como texto literal: la URL, la clase o el toast llevan `${...}`
 * en vez del valor real. Escanea app/, components/ y lib/.
 *
 * Criterio: se busca la secuencia cruda `\${` en cualquier línea de código, no solo
 * dentro de backticks. Hoy no existe ningún uso legítimo (verificado con
 * `git grep -n -F '\${'`); si algún día aparece uno en una regex o comentario, se
 * acota ese caso concreto aquí, no se apaga la guardia.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['app', 'components', 'lib'];
const EXT = /\.(ts|tsx)$/;
const ESCAPE = '\\${';

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '__tests__', '__mocks__'].includes(entry.name)) continue;
      out.push(...archivos(full));
    } else if (EXT.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('sin escapes literales en plantillas de texto', () => {
  it('ningún archivo de app/, components/ o lib/ contiene \\${ en una plantilla', () => {
    const hallazgos: string[] = [];
    for (const dir of DIRS) {
      const base = path.join(ROOT, dir);
      if (!fs.existsSync(base)) continue;
      for (const file of archivos(base)) {
        fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((linea, i) => {
          if (linea.includes(ESCAPE)) {
            hallazgos.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}`);
          }
        });
      }
    }
    expect(hallazgos).toEqual([]);
  });
});
