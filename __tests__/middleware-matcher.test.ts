import fs from 'fs';
import path from 'path';

// El matcher se lee como texto: config.matcher debe quedar como literal estatico
// (next build lo exige) y no conviene importar middleware.ts en jest (next-auth/edge).
const src = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf8');

function extraerConst(nombre: string): string {
  const m = src.match(new RegExp(`export const ${nombre} =\\s*'([^']+)'`));
  if (!m) throw new Error(`No se encontro la constante ${nombre} en middleware.ts`);
  // Texto del fuente -> valor real del string (deshace el doble escape de los backslashes).
  return m[1].replace(/\\\\/g, '\\');
}

function extraerMatcherLiteral(): string {
  const m = src.match(/matcher:\s*\[\s*'([^']+)'/);
  if (!m) throw new Error('No se encontro el literal de config.matcher en middleware.ts');
  return m[1].replace(/\\\\/g, '\\');
}

const PATRON = extraerConst('MATCHER_PATTERN');

// Next 14 compila el matcher como new RegExp('^' + patron + '$') sobre el pathname.
const aplicaMiddleware = (pathname: string) => new RegExp(`^${PATRON}$`).test(pathname);

describe('middleware matcher', () => {
  it('el literal de config.matcher es identico a MATCHER_PATTERN', () => {
    expect(extraerMatcherLiteral()).toBe(PATRON);
  });

  it.each([
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/favicon.ico',
    '/_next/static/chunks/x.js',
    '/_next/image',
    '/api/catalogo',
    '/api/auth/session',
    '/login',
    '/catalogo/algun-slug',
    '/catalogo/clientes/algun-slug',
  ])('NO pasa por el middleware: %s', (pathname) => {
    expect(aplicaMiddleware(pathname)).toBe(false);
  });

  it.each([
    '/dashboard',
    '/bodega',
    '/admin/usuarios',
    '/precios',
    '/deudas',
    '/admin/importar',
    '/',
    '/ventas/kardex',
  ])('SI pasa por el middleware (sigue protegida): %s', (pathname) => {
    expect(aplicaMiddleware(pathname)).toBe(true);
  });

  it('caso borde: los query strings no cuentan (el matcher corre sobre el pathname)', () => {
    // Aunque /bodega?f=a.png termina en .png, Next evalua solo el pathname /bodega.
    expect(aplicaMiddleware('/bodega')).toBe(true);
  });
});
