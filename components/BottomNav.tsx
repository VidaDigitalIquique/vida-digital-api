'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, ShoppingCart, Users, LayoutList, Tag, Box, Camera, Heart, Package, Settings, RefreshCw, ImageIcon, Filter } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from 'next-auth/react';
import { useAlertas } from '@/contexts/AlertasContext';

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const rol = (session?.user as any)?.rol as string;
  const { alertasCount } = useAlertas();
  const searchParams = useSearchParams();
  const modoChina = searchParams.get('modo') === 'china';
  const [adminOpen, setAdminOpen] = useState(false);

  const linkClass = (active: boolean) => cn(
    'flex flex-col items-center justify-center flex-shrink-0 w-16 h-full gap-1 transition-colors',
    active ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
  );

  const deseadosActive = pathname.startsWith('/deseados') && !modoChina;

  const DeseadosIcon = (
    <div className="relative">
      <Heart className="w-6 h-6" />
      {alertasCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
          {alertasCount > 99 ? '99+' : alertasCount}
        </span>
      )}
    </div>
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl pb-safe">
      <div
        className="flex items-center h-full overflow-x-auto px-2 gap-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >

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
            <Link href="/ventas/kardex" className={linkClass(pathname.startsWith('/ventas'))}>
              <Users className="w-6 h-6" />
              <span className="text-[10px] font-medium">Kardex</span>
            </Link>
            <Link href="/catalogo/admin" className={linkClass(pathname.startsWith('/catalogo'))}>
              <LayoutList className="w-6 h-6" />
              <span className="text-[10px] font-medium">Catálogo</span>
            </Link>
            <Link href="/admin/categorias" className={linkClass(pathname.startsWith('/admin/categorias'))}>
              <Tag className="w-6 h-6" />
              <span className="text-[10px] font-medium">Categorías</span>
            </Link>
            <Link href="/bodega" className={linkClass(pathname.startsWith('/bodega') && !pathname.startsWith('/bodega/despachos'))}>
              <Box className="w-6 h-6" />
              <span className="text-[10px] font-medium">Bodega</span>
            </Link>
            <Link href="/bodega/despachos" className={linkClass(pathname.startsWith('/bodega/despachos'))}>
              <Camera className="w-6 h-6" />
              <span className="text-[10px] font-medium">Despachos</span>
            </Link>
            <Link href="/deseados" className={linkClass(deseadosActive)}>
              {DeseadosIcon}
              <span className="text-[10px] font-medium">Deseados</span>
            </Link>
            <Link href="/deseados?modo=china" className={linkClass(pathname.startsWith('/deseados') && modoChina)}>
              <Package className="w-6 h-6" />
              <span className="text-[10px] font-medium">China</span>
            </Link>
            <button
              onClick={() => setAdminOpen(true)}
              className="flex flex-col items-center justify-center flex-shrink-0 w-16 h-full gap-1 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <Settings className="w-6 h-6" />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          </>
        )}

        {rol === 'vendedor' && (
          <>
            <Link href="/precios" className={linkClass(pathname.startsWith('/precios'))}>
              <ShoppingCart className="w-6 h-6" />
              <span className="text-[10px] font-medium">Ventas</span>
            </Link>
            <Link href="/ventas/kardex" className={linkClass(pathname.startsWith('/ventas'))}>
              <Users className="w-6 h-6" />
              <span className="text-[10px] font-medium">Kardex</span>
            </Link>
            <Link href="/catalogo/admin" className={linkClass(pathname.startsWith('/catalogo'))}>
              <LayoutList className="w-6 h-6" />
              <span className="text-[10px] font-medium">Catálogo</span>
            </Link>
            <Link href="/deseados" className={linkClass(deseadosActive)}>
              {DeseadosIcon}
              <span className="text-[10px] font-medium">Deseados</span>
            </Link>
            <Link href="/deseados?modo=china" className={linkClass(pathname.startsWith('/deseados') && modoChina)}>
              <Package className="w-6 h-6" />
              <span className="text-[10px] font-medium">China</span>
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

      {rol === 'admin' && (
        <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
          <SheetTrigger className="hidden" />
          <SheetContent side="right" className="w-[80vw] sm:w-[300px] p-6">
            <div className="flex flex-col justify-between h-full pt-8">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                  Administración
                </h3>
                <Link href="/admin/importar" onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100">
                  <RefreshCw className="w-4 h-4 text-zinc-400" /> Sincronizar WinFac
                </Link>
                <Link href="/admin/subir-imagenes" onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100">
                  <ImageIcon className="w-4 h-4 text-zinc-400" /> Subir Imágenes
                </Link>
                <Link href="/admin/usuarios" onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100">
                  <Users className="w-4 h-4 text-zinc-400" /> Usuarios
                </Link>
                <Link href="/admin/kardex-exclusiones" onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100">
                  <Filter className="w-4 h-4 text-zinc-400" /> Exclusiones Kardex
                </Link>
              </div>
              <Button variant="destructive" onClick={() => signOut()} className="w-full">
                Cerrar sesión
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
