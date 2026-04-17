'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Box, Camera, Users, Heart, ShoppingCart, LayoutList } from 'lucide-react';
import { useSession } from 'next-auth/react';

export function BottomNav({ alertasCount = 0 }: { alertasCount?: number }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const rol = (session?.user as any)?.rol as string;

  const linkClass = (active: boolean) => cn(
    'flex flex-col items-center justify-center w-full h-full gap-1 transition-colors',
    active ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
  );

  const deseadosClass = cn(
    'relative flex flex-col items-center justify-center w-full h-full gap-1 transition-colors',
    pathname.startsWith('/deseados') ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
  );

  const deseadosBadge = alertasCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
      {alertasCount > 99 ? '99+' : alertasCount}
    </span>
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl pb-safe">
      <div className="flex items-center justify-around h-full px-2">

        {rol === 'admin' && (
          <>
            <Link href="/dashboard" className={linkClass(pathname === '/dashboard')}>
              <Home className="w-6 h-6" />
              <span className="text-[10px] font-medium">Dashboard</span>
            </Link>
            <Link href="/precios" className={linkClass(pathname.startsWith('/precios'))}>
              <ShoppingCart className="w-6 h-6" />
              <span className="text-[10px] font-medium">Ventas</span>
            </Link>
            <Link href="/catalogo/admin" className={linkClass(pathname.startsWith('/catalogo'))}>
              <LayoutList className="w-6 h-6" />
              <span className="text-[10px] font-medium">Catálogo</span>
            </Link>
            <Link href="/bodega" className={linkClass(pathname.startsWith('/bodega'))}>
              <Box className="w-6 h-6" />
              <span className="text-[10px] font-medium">Bodega</span>
            </Link>
            <Link href="/deseados" className={deseadosClass}>
              <div className="relative">
                <Heart className="w-6 h-6" />
                {deseadosBadge}
              </div>
              <span className="text-[10px] font-medium">Deseados</span>
            </Link>
          </>
        )}

        {rol === 'vendedor' && (
          <>
            <Link href="/precios" className={linkClass(pathname.startsWith('/precios'))}>
              <ShoppingCart className="w-6 h-6" />
              <span className="text-[10px] font-medium">Ventas</span>
            </Link>
            <Link href="/ventas/kardex" className={linkClass(pathname.startsWith('/ventas/kardex'))}>
              <Users className="w-6 h-6" />
              <span className="text-[10px] font-medium">Kardex</span>
            </Link>
            <Link href="/catalogo/admin" className={linkClass(pathname.startsWith('/catalogo'))}>
              <LayoutList className="w-6 h-6" />
              <span className="text-[10px] font-medium">Catálogo</span>
            </Link>
            <Link href="/deseados" className={deseadosClass}>
              <div className="relative">
                <Heart className="w-6 h-6" />
                {deseadosBadge}
              </div>
              <span className="text-[10px] font-medium">Deseados</span>
            </Link>
          </>
        )}

        {rol === 'bodeguero' && (
          <>
            <Link href="/bodega" className={linkClass(pathname.startsWith('/bodega') && !pathname.startsWith('/bodega/despachos'))}>
              <Box className="w-6 h-6" />
              <span className="text-[10px] font-medium">Bodega</span>
            </Link>
            <Link href="/bodega/despachos" className={linkClass(pathname.startsWith('/bodega/despachos'))}>
              <Camera className="w-6 h-6" />
              <span className="text-[10px] font-medium">Despachos</span>
            </Link>
          </>
        )}

      </div>
    </nav>
  );
}
