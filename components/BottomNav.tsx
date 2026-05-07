'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ShoppingCart, Users, LayoutList, Tag, Box, Camera,
  Heart, Package, Settings, RefreshCw, ImageIcon,
  Filter, UserPlus, FileText, ChevronRight, ClipboardList, Banknote, Wallet, Wand2
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from 'next-auth/react';
import { useAlertas } from '@/contexts/AlertasContext';

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const rol = (session?.user as any)?.rol as string;
  const { alertasCount, stockBajoCount } = useAlertas();
  const searchParams = useSearchParams();
  const modoChina = searchParams.get('modo') === 'china';

  const [ventasOpen, setVentasOpen] = useState(false);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [bodegaOpen, setBodegaOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const isAdmin = rol === 'admin';
  const isVendedor = rol === 'vendedor';
  const isBodeguero = rol === 'bodeguero';
  const isSupervisor = rol === 'supervisor';

  const btnClass = (active: boolean) => cn(
    'flex flex-col items-center justify-center flex-shrink-0 w-16 h-full gap-1 transition-colors',
    active
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
  );

  const sheetLink = (href: string, icon: React.ReactNode, label: string, onClose: () => void) => (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'flex items-center justify-between py-3 font-medium border-b border-zinc-100 dark:border-zinc-800',
        pathname === href || pathname.startsWith(href + '/')
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-zinc-700 dark:text-zinc-200'
      )}
    >
      <span className="flex items-center gap-3">
        <span className="text-zinc-400">{icon}</span>
        {label}
      </span>
      <ChevronRight className="w-4 h-4 text-zinc-300" />
    </Link>
  );

  const ventasActive =
    pathname.startsWith('/precios') ||
    pathname.startsWith('/ventas') ||
    pathname.startsWith('/prenotas') ||
    pathname.startsWith('/clientes-nuevos');

  const catalogoActive =
    pathname.startsWith('/catalogo') ||
    pathname.startsWith('/admin/categorias') ||
    pathname.startsWith('/catalog-image') ||
    (pathname.startsWith('/deseados') && modoChina);

  const bodegaActive =
    pathname.startsWith('/bodega');

  const deseadosActive = pathname.startsWith('/deseados') && !modoChina;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl pb-safe">
      <div
        className="flex items-center justify-around h-full px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >

        {/* Ventas — admin, vendedor, supervisor */}
        {(isAdmin || isVendedor || isSupervisor) && (
          <>
            <button
              onClick={() => setVentasOpen(true)}
              className={btnClass(ventasActive)}
            >
              <ShoppingCart className="w-6 h-6" />
              <span className="text-[10px] font-medium">Ventas</span>
            </button>
            <Sheet open={ventasOpen} onOpenChange={setVentasOpen}>
              <SheetTrigger className="hidden" />
              <SheetContent side="bottom" className="rounded-t-2xl p-6 pb-10">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                  Ventas
                </h3>
                <div className="space-y-0">
                  {(isAdmin || isVendedor) && sheetLink('/precios', <ShoppingCart className="w-5 h-5" />, 'Sala de Venta', () => setVentasOpen(false))}
                  {(isAdmin || isVendedor) && sheetLink('/ventas/kardex', <Users className="w-5 h-5" />, 'Kardex Cliente', () => setVentasOpen(false))}
                  {(isAdmin || isVendedor) && sheetLink('/prenotas', <FileText className="w-5 h-5" />, 'Pre-Notas', () => setVentasOpen(false))}
                  {(isAdmin || isVendedor || isSupervisor) && sheetLink('/clientes-nuevos', <UserPlus className="w-5 h-5" />, 'Clientes Nuevos', () => setVentasOpen(false))}
                  {isVendedor && sheetLink('/deudas', <Banknote className="w-5 h-5" />, 'Mis Deudas', () => setVentasOpen(false))}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}

        {/* Catálogo — admin, vendedor */}
        {(isAdmin || isVendedor) && (
          <>
            <button
              onClick={() => setCatalogoOpen(true)}
              className={btnClass(catalogoActive)}
            >
              <LayoutList className="w-6 h-6" />
              <span className="text-[10px] font-medium">Catálogo</span>
            </button>
            <Sheet open={catalogoOpen} onOpenChange={setCatalogoOpen}>
              <SheetTrigger className="hidden" />
              <SheetContent side="bottom" className="rounded-t-2xl p-6 pb-10">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                  Catálogo
                </h3>
                <div className="space-y-0">
                  {sheetLink('/catalogo/admin', <LayoutList className="w-5 h-5" />, 'Crear Catálogo', () => setCatalogoOpen(false))}
                  {sheetLink('/catalogo/clientes', <Users className="w-5 h-5" />, 'Catálogos por Cliente', () => setCatalogoOpen(false))}
                  {sheetLink('/admin/categorias', <Tag className="w-5 h-5" />, 'Categorías', () => setCatalogoOpen(false))}
                  {sheetLink('/catalog-image', <Wand2 className="w-5 h-5" />, 'Generar Imágenes', () => setCatalogoOpen(false))}
                  <Link
                    href="/deseados?modo=china"
                    onClick={() => setCatalogoOpen(false)}
                    className={cn(
                      'flex items-center justify-between py-3 font-medium border-b border-zinc-100 dark:border-zinc-800',
                      pathname.startsWith('/deseados') && modoChina
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-700 dark:text-zinc-200'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-zinc-400 relative">
                        <Package className="w-5 h-5" />
                        {stockBajoCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
                            {stockBajoCount > 99 ? '99+' : stockBajoCount}
                          </span>
                        )}
                      </span>
                      Pedir a China
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-300" />
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}

        {/* Bodega — admin, bodeguero, vendedor */}
        {(isAdmin || isBodeguero || isVendedor) && (
          <>
            <button
              onClick={() => setBodegaOpen(true)}
              className={btnClass(bodegaActive)}
            >
              <Box className="w-6 h-6" />
              <span className="text-[10px] font-medium">Bodega</span>
            </button>
            <Sheet open={bodegaOpen} onOpenChange={setBodegaOpen}>
              <SheetTrigger className="hidden" />
              <SheetContent side="bottom" className="rounded-t-2xl p-6 pb-10">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                  Bodega
                </h3>
                <div className="space-y-0">
                  {sheetLink('/bodega', <Box className="w-5 h-5" />, 'Ubicaciones en Bodega', () => setBodegaOpen(false))}
                  {sheetLink('/bodega/despachos', <Camera className="w-5 h-5" />, 'Despachos', () => setBodegaOpen(false))}
                  {sheetLink('/bodega/registro-notas', <ClipboardList className="w-5 h-5" />, 'Registro de Notas', () => setBodegaOpen(false))}
                  {isBodeguero && sheetLink('/deudas', <Banknote className="w-5 h-5" />, 'Mis Deudas', () => setBodegaOpen(false))}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}

        {/* Deseados — admin, vendedor */}
        {(isAdmin || isVendedor) && (
          <Link href="/deseados" className={btnClass(deseadosActive)}>
            <div className="relative">
              <Heart className="w-6 h-6" />
              {alertasCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
                  {alertasCount > 99 ? '99+' : alertasCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Deseados</span>
          </Link>
        )}

        {/* Deudas — admin */}
        {isAdmin && (
          <Link href="/deudas" className={btnClass(pathname.startsWith('/deudas'))}>
            <Banknote className="w-6 h-6" />
            <span className="text-[10px] font-medium">Deudas</span>
          </Link>
        )}

        {/* Admin — solo admin */}
        {isAdmin && (
          <>
            <button
              onClick={() => setAdminOpen(true)}
              className={btnClass(false)}
            >
              <Settings className="w-6 h-6" />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
            <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
              <SheetTrigger className="hidden" />
              <SheetContent side="right" className="w-[80vw] sm:w-[300px] p-6">
                <div className="flex flex-col h-full pt-8 gap-4">
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                      Administración
                    </h3>
                    <Link href="/admin/importar" onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100 dark:border-zinc-800">
                      <RefreshCw className="w-4 h-4 text-zinc-400" /> Sincronizar WinFac
                    </Link>
                    <Link href="/admin/subir-imagenes" onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100 dark:border-zinc-800">
                      <ImageIcon className="w-4 h-4 text-zinc-400" /> Subir Imágenes
                    </Link>
                    <Link href="/admin/usuarios" onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100 dark:border-zinc-800">
                      <Users className="w-4 h-4 text-zinc-400" /> Usuarios
                    </Link>
                    <Link href="/admin/kardex-exclusiones" onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100 dark:border-zinc-800">
                      <Filter className="w-4 h-4 text-zinc-400" /> Exclusiones Kardex
                    </Link>
                    <Link href="/pettycash" onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100 dark:border-zinc-800">
                      <Wallet className="w-4 h-4 text-zinc-400" /> Pettycash
                    </Link>
                    <Link href="/sueldos" onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100 dark:border-zinc-800">
                      <Users className="w-4 h-4 text-zinc-400" /> Sueldos
                    </Link>
                    <Link href="/deudas" onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 py-3 font-medium border-b border-zinc-100 dark:border-zinc-800">
                      <Banknote className="w-4 h-4 text-zinc-400" /> Deudas
                    </Link>
                  </div>
                  <Button variant="destructive" onClick={() => signOut()} className="w-full">
                    Cerrar sesión
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}

      </div>
    </nav>
  );
}
