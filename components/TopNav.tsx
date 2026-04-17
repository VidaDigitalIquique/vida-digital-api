'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut, useSession } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import {
  Home,
  Box,
  LogOut,
  ChevronDown,
  RefreshCw,
  ImageIcon,
  Users,
  ShoppingCart,
  LayoutList,
  Filter,
  Camera,
  Tag,
  Heart,
  Package,
  Warehouse
} from 'lucide-react';
import { useAlertas } from '@/contexts/AlertasContext';

export function TopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { alertasCount, stockBajoCount } = useAlertas();
  const isAdmin = (session?.user as any)?.rol === 'admin';
  const rol = (session?.user as any)?.rol as string;

  const logoHref = rol === 'bodeguero' ? '/bodega' : rol === 'vendedor' ? '/precios' : '/dashboard';
  const searchParams = useSearchParams();
  const modoChina = searchParams.get('modo') === 'china';

  const [ventasOpen, setVentasOpen] = useState(false);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [bodegaOpen, setBodegaOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const openOnly = (which: 'ventas' | 'catalogo' | 'bodega' | 'admin') => {
    setVentasOpen(which === 'ventas');
    setCatalogoOpen(which === 'catalogo');
    setBodegaOpen(which === 'bodega');
    setAdminOpen(which === 'admin');
  };

  const navLink = (active: boolean) => cn(
    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900',
    active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'
  );

  const dropdownTrigger = (active: boolean) => cn(
    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none',
    active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'
  );

  return (
    <header className="hidden md:flex sticky top-0 z-50 w-full h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl transition-all">
      <div className="container flex h-16 max-w-7xl items-center justify-between mx-auto px-4">
        <div className="flex items-center gap-8">
          <Link href={logoHref} className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">
            VidaDigital
          </Link>
          <nav className="flex items-center space-x-1">

            {/* 1. Dashboard — solo admin */}
            {isAdmin && (
              <Link href="/dashboard" className={navLink(pathname === '/dashboard')}>
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
            )}

            {/* 2. Ventas — admin y vendedor */}
            {(isAdmin || rol === 'vendedor') && (
              <DropdownMenu open={ventasOpen} onOpenChange={setVentasOpen}>
                <DropdownMenuTrigger
                  onMouseEnter={() => openOnly('ventas')}
                  className={dropdownTrigger(
                    pathname.startsWith('/precios') || pathname.startsWith('/ventas')
                  )}
                >
                  Ventas <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48" onMouseLeave={() => setVentasOpen(false)}>
                  <DropdownMenuItem>
                    <Link href="/precios" className="flex items-center gap-2 w-full">
                      <ShoppingCart className="w-4 h-4" /> Sala de Venta
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/ventas/kardex" className="flex items-center gap-2 w-full">
                      <Users className="w-4 h-4" /> Kardex Cliente
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 3. Catálogo — admin y vendedor */}
            {(isAdmin || rol === 'vendedor') && (
              <DropdownMenu open={catalogoOpen} onOpenChange={setCatalogoOpen}>
                <DropdownMenuTrigger
                  onMouseEnter={() => openOnly('catalogo')}
                  className={dropdownTrigger(
                    pathname.startsWith('/catalogo') || pathname.startsWith('/admin/categorias')
                  )}
                >
                  Catálogo <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48" onMouseLeave={() => setCatalogoOpen(false)}>
                  <DropdownMenuItem>
                    <Link href="/catalogo/admin" className="flex items-center gap-2 w-full">
                      <LayoutList className="w-4 h-4" /> Crear Catálogo
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/admin/categorias" className="flex items-center gap-2 w-full">
                      <Tag className="w-4 h-4" /> Categorías
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 4. Bodega — admin y bodeguero */}
            {(isAdmin || rol === 'bodeguero') && (
              <DropdownMenu open={bodegaOpen} onOpenChange={setBodegaOpen}>
                <DropdownMenuTrigger
                  onMouseEnter={() => openOnly('bodega')}
                  className={dropdownTrigger(pathname.startsWith('/bodega'))}
                >
                  Bodega <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52" onMouseLeave={() => setBodegaOpen(false)}>
                  <DropdownMenuItem>
                    <Link href="/bodega" className="flex items-center gap-2 w-full">
                      <Box className="w-4 h-4" /> Ubicaciones en Bodega
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/bodega/despachos" className="flex items-center gap-2 w-full">
                      <Camera className="w-4 h-4" /> Despachos
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 5. Deseados — admin y vendedor */}
            {(isAdmin || rol === 'vendedor') && (
              <Link href="/deseados" className={navLink(pathname.startsWith('/deseados') && !modoChina)}>
                <span className="relative flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Deseados
                  {alertasCount > 0 && (
                    <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-3.5 flex items-center justify-center px-0.5 leading-none">
                      {alertasCount > 99 ? '99+' : alertasCount}
                    </span>
                  )}
                </span>
              </Link>
            )}

            {/* 5b. Pedir a China — admin y vendedor */}
            {(isAdmin || rol === 'vendedor') && (
              <Link href="/deseados?modo=china" className={navLink(pathname.startsWith('/deseados') && modoChina)}>
                <span className="relative flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  China
                  {stockBajoCount > 0 && (
                    <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-3.5 flex items-center justify-center px-0.5 leading-none">
                      {stockBajoCount > 99 ? '99+' : stockBajoCount}
                    </span>
                  )}
                </span>
              </Link>
            )}

            {/* 6. Administración — solo admin */}
            {isAdmin && (
              <DropdownMenu open={adminOpen} onOpenChange={setAdminOpen}>
                <DropdownMenuTrigger
                  onMouseEnter={() => openOnly('admin')}
                  className={dropdownTrigger(
                    pathname.startsWith('/admin') && !pathname.startsWith('/admin/categorias')
                  )}
                >
                  Administración <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48" onMouseLeave={() => setAdminOpen(false)}>
                  <DropdownMenuItem>
                    <Link href="/admin/importar" className="flex items-center gap-2 w-full">
                      <RefreshCw className="w-4 h-4" /> Sincronizar WinFac
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/admin/subir-imagenes" className="flex items-center gap-2 w-full">
                      <ImageIcon className="w-4 h-4" /> Subir Imágenes
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/admin/usuarios" className="flex items-center gap-2 w-full">
                      <Users className="w-4 h-4" /> Usuarios
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/admin/kardex-exclusiones" className="flex items-center gap-2 w-full">
                      <Filter className="w-4 h-4" /> Exclusiones Kardex
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => signOut()} className="p-2 text-zinc-500 hover:text-red-500 transition-colors" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
