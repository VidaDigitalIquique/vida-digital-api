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
  ClipboardList,
  Banknote,
  ShieldCheck,
  Phone,
  UserPlus,
  Heart,
  Globe,
  Wallet,
  DollarSign
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

  const getSaludo = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Buenos días';
    if (hora >= 12 && hora < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const primerNombre = ((session?.user as any)?.nombre as string)?.split(' ')[0] ?? '';

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

  const navLinkSm = (active: boolean) => cn(
    'flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold uppercase tracking-wide transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900',
    active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-zinc-500 dark:text-zinc-400'
  );

  const dropdownTrigger = (active: boolean) => cn(
    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium uppercase transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none',
    active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'
  );

  return (
    <header className="hidden md:block sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl transition-all">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex h-12 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href={logoHref} className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">
            VidaDigital
          </Link>
          <nav className="flex items-center space-x-1">

            {/* 2. Ventas — admin y vendedor */}
            {(isAdmin || rol === 'vendedor') && (
              <DropdownMenu open={ventasOpen} onOpenChange={setVentasOpen}>
                <DropdownMenuTrigger
                  onMouseEnter={() => openOnly('ventas')}
                  className={dropdownTrigger(
                    pathname.startsWith('/precios') ||
                    pathname.startsWith('/ventas')
                  )}
                >
                  VENTAS <ChevronDown className="w-4 h-4" />
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
                    pathname.startsWith('/catalogo') ||
                    pathname.startsWith('/admin/categorias') ||
                    (pathname.startsWith('/deseados') && modoChina)
                  )}
                >
                  CATÁLOGO <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48" onMouseLeave={() => setCatalogoOpen(false)}>
                  <DropdownMenuItem>
                    <Link href="/catalogo/admin" className="flex items-center gap-2 w-full">
                      <LayoutList className="w-4 h-4" /> Crear Catálogo
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/catalogo/clientes" className="flex items-center gap-2 w-full">
                      <Users className="w-4 h-4" /> Catálogos por Cliente
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

            {/* 4. Bodega — admin, bodeguero y vendedor */}
            {(isAdmin || rol === 'bodeguero' || rol === 'vendedor') && (
              <DropdownMenu open={bodegaOpen} onOpenChange={setBodegaOpen}>
                <DropdownMenuTrigger
                  onMouseEnter={() => openOnly('bodega')}
                  className={dropdownTrigger(pathname.startsWith('/bodega'))}
                >
                  BODEGA <ChevronDown className="w-4 h-4" />
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
                  <DropdownMenuItem>
                    <Link href="/bodega/registro-notas" className="flex items-center gap-2 w-full">
                      <ClipboardList className="w-4 h-4" /> Registro de Notas
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  ADMINISTRACIÓN <ChevronDown className="w-4 h-4" />
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
          {primerNombre && (
            <span className="text-sm text-blue-400 dark:text-blue-400 hidden lg:block">
              {getSaludo()}, <span className="font-semibold text-zinc-700 dark:text-zinc-300">{primerNombre}</span>
            </span>
          )}
          <button onClick={() => signOut()} className="p-2 text-zinc-500 hover:text-red-500 transition-colors" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* ── Segunda fila ── */}
      <nav className="flex items-center gap-1 pb-1.5 -mt-0.5">
        {(isAdmin || rol === 'vendedor') && (
          <Link href="/prenotas" className={navLinkSm(pathname.startsWith('/prenotas'))}>
            <ClipboardList className="w-3.5 h-3.5" />
            PRENOTAS
          </Link>
        )}
        {(isAdmin || rol === 'vendedor') && (
          <Link href="/clientes-nuevos" className={navLinkSm(pathname.startsWith('/clientes-nuevos'))}>
            <UserPlus className="w-3.5 h-3.5" />
            CLIENTES NUEVOS
          </Link>
        )}
        {(isAdmin || rol === 'vendedor') && (
          <Link href="/deseados" className={navLinkSm(pathname.startsWith('/deseados') && !modoChina)}>
            <Heart className="w-3.5 h-3.5" />
            DESEADOS
          </Link>
        )}
        {(isAdmin || rol === 'vendedor') && (
          <Link href="/deseados?modo=china" className={navLinkSm(pathname.startsWith('/deseados') && !!modoChina)}>
            <div className="relative">
              <Globe className="w-3.5 h-3.5" />
              CHINA
              {stockBajoCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
                  {stockBajoCount > 99 ? '99+' : stockBajoCount}
                </span>
              )}
            </div>
          </Link>
        )}
        {isAdmin && (
          <Link href="/pettycash" className={navLinkSm(pathname.startsWith('/pettycash'))}>
            <Wallet className="w-3.5 h-3.5" />
            PETTYCASH
          </Link>
        )}
        {(!isAdmin && (rol === 'vendedor' || rol === 'bodeguero')) && (
          <Link href="/deudas" className={navLinkSm(pathname.startsWith('/deudas'))}>
            <Banknote className="w-3.5 h-3.5" />
            DEUDAS
          </Link>
        )}
        {isAdmin && (
          <Link href="/sueldos" className={navLinkSm(pathname.startsWith('/sueldos'))}>
            <DollarSign className="w-3.5 h-3.5" />
            SUELDOS
          </Link>
        )}
        {(isAdmin || rol === 'vendedor') && (
          <Link href="/seguimientos" className={navLinkSm(pathname.startsWith('/seguimientos'))}>
            <Phone className="w-3.5 h-3.5" />
            SEGUIMIENTOS
          </Link>
        )}
        {(isAdmin || rol === 'vendedor') && (
          <Link href="/garantias" className={navLinkSm(pathname.startsWith('/garantias'))}>
            <ShieldCheck className="w-3.5 h-3.5" />
            GARANTÍAS
          </Link>
        )}
      </nav>
      </div>
    </header>
  );
}
