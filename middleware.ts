import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const RUTAS_POR_ROL: Record<string, string[]> = {
  admin: ['/dashboard', '/precios', '/ventas', '/bodega', '/catalogo', '/admin', '/inventario', '/deseados', '/alertas-stock', '/clientes-nuevos', '/prenotas', '/pettycash', '/sueldos', '/deudas', '/seguimientos', '/garantias', '/caja-mayor', '/vendedores'],
  vendedor: ['/precios', '/ventas', '/catalogo', '/bodega', '/deseados', '/alertas-stock', '/clientes-nuevos', '/prenotas', '/deudas', '/seguimientos', '/garantias', '/admin/importar', '/caja-mayor', '/vendedores'],
  bodeguero: ['/bodega', '/deudas'],
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token as { rol?: string } | null;
    const rol = token?.rol;

    if (!rol || !RUTAS_POR_ROL[rol]) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const rutasPermitidas = RUTAS_POR_ROL[rol];
    const tieneAcceso = rutasPermitidas.some(ruta => pathname.startsWith(ruta));

    if (!tieneAcceso) {
      const primeraRuta = rutasPermitidas[0];
      return NextResponse.redirect(new URL(primeraRuta, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Archivos de public/ (manifest, iconos, etc.) no deben pasar por withAuth.
// ponytail: literal inline a proposito; next build exige config.matcher estatico.
// __tests__/middleware-matcher.test.ts extrae el literal del fuente y prueba el comportamiento.
export const config = {
  matcher: [
    '/((?!api/|login|catalogo|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|json|txt|xml|webmanifest|js|map)$).*)',
  ],
};
