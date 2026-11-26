import fs from 'fs';
import path from 'path';

// El matcher se lee como texto: config.matcher debe quedar como literal estatico
// (next build lo exige) y no conviene importar middleware.ts en jest (next-auth/edge).
const src = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf8');

function extraerMatcherLiteral(): string {
  const m = src.match(/matcher:\s*\[\s*'([^']+)'/);
  if (!m) throw new Error('No se encontro el literal de config.matcher en middleware.ts');
  return m[1].replace(/\\\\/g, '\\');
}

const PATRON = extraerMatcherLiteral();

// Next 14 compila el matcher como new RegExp('^' + patron + '$') sobre el pathname.
const aplicaMiddleware = (pathname: string) => new RegExp(`^${PATRON}$`).test(pathname);

// Lista de rutas de un rol dentro de RUTAS_POR_ROL, leida del fuente (mismo criterio
// que el matcher: no se importa middleware.ts por next-auth/edge).
function rutasDe(rol: string): string[] {
  const m = src.match(new RegExp(`${rol}:\\s*\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`No se encontro la lista de ${rol} en RUTAS_POR_ROL`);
  return (m[1].match(/'[^']+'/g) ?? []).map((x) => x.slice(1, -1));
}

describe('RUTAS_POR_ROL — modulo vendedores', () => {
  it('vendedor puede entrar a /vendedores', () => {
    expect(rutasDe('vendedor')).toContain('/vendedores');
  });

  it('bodeguero NO entra a /vendedores (queda fuera y se le redirige)', () => {
    expect(rutasDe('bodeguero')).not.toContain('/vendedores');
  });

  it('admin conserva /vendedores', () => {
    expect(rutasDe('admin')).toContain('/vendedores');
  });
});

describe('middleware matcher', () => {
  it('el patron se define una sola vez: no existe el export MATCHER_PATTERN', () => {
    expect(src).not.toContain('MATCHER_PATTERN');
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
