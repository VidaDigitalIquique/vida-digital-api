'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ShoppingCart, Users, RefreshCw, ShieldCheck, Landmark, FileText, UserPlus,
  LayoutList, Tag, Package, Box, Camera, ClipboardList, Heart, Phone, Banknote,
  ImageIcon, Filter, Wallet, type LucideIcon } from 'lucide-react';
import flags from '@/config/feature-flags.json';
import { useAlertas } from '@/contexts/AlertasContext';

type Option = { href: string; label: string; icon: LucideIcon; count?: number };
const option = (href: string, label: string, icon: LucideIcon, count?: number): Option => ({ href, label, icon, count });

export function MobileNav({ rol }: { rol: string | undefined }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const china = searchParams.get('modo') === 'china';
  const { alertasCount, stockBajoCount, seguimientosCount } = useAlertas();
  const home = rol === 'admin' ? '/dashboard' : rol === 'vendedor' ? '/precios' : rol === 'bodeguero' ? '/bodega' : undefined;
  const [open, setOpen] = useState(() => Boolean(home && pathname === home));
  const previousPath = useRef(pathname);
  const header = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (previousPath.current !== pathname) setOpen(false);
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); button.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  const admin = rol === 'admin';
  const comercial = admin || rol === 'vendedor';
  const almacen = comercial || rol === 'bodeguero';
  const groups: { title: string; items: Option[] }[] = [
    { title: 'Ventas', items: [
      ...(comercial ? [
        option('/precios', 'Sala de Venta', ShoppingCart),
        option('/ventas/kardex', 'Kardex Cliente', Users),
        option('/admin/importar', 'Sincronizar WinFac', RefreshCw),
        option('/garantias', 'Garantías', ShieldCheck),
        option('/caja-mayor', 'Caja Mayor', Landmark),
        option('/prenotas', 'Pre-Notas', FileText),
      ] : []),
      ...(comercial || rol === 'supervisor' ? [option('/clientes-nuevos', 'Clientes Nuevos', UserPlus)] : []),
    ] },
    { title: 'Catálogo', items: comercial ? [
      option('/catalogo/admin', 'Crear Catálogo', LayoutList),
      option('/catalogo/clientes', 'Catálogos por Cliente', Users),
      option('/admin/categorias', 'Categorías', Tag),
      option('/deseados?modo=china', 'Pedir a China', Package, stockBajoCount),
    ] : [] },
    { title: 'Bodega', items: almacen ? [
      option('/bodega', 'Ubicaciones en Bodega', Box),
      option('/bodega/despachos', 'Despachos', Camera),
      option('/bodega/registro-notas', 'Registro de Notas', ClipboardList),
    ] : [] },
    { title: '', items: [
      ...(comercial ? [option('/deseados', 'Deseados', Heart, alertasCount)] : []),
      ...(comercial && flags.seguimientos ? [option('/seguimientos', 'Seguimientos', Phone, seguimientosCount)] : []),
      ...(almacen ? [option('/deudas', admin ? 'Deudas' : 'Mis Deudas', Banknote)] : []),
    ] },
    { title: 'Administración', items: admin ? [
      option('/admin/importar', 'Sincronizar WinFac', RefreshCw),
      option('/admin/subir-imagenes', 'Subir Imágenes', ImageIcon),
      option('/admin/usuarios', 'Usuarios', Users),
      option('/admin/kardex-exclusiones', 'Exclusiones Kardex', Filter),
      option('/admin/caja-config', 'Caja Mayor Config', Landmark),
      option('/pettycash', 'Pettycash', Wallet),
      option('/sueldos', 'Sueldos', Users),
    ] : [] },
    { title: '', items: admin && flags['vendedores-modulo'] ? [option('/vendedores', 'VENDEDORES', Users)] : [] },
  ];

  const renderLink = ({ href, label, icon: Icon, count = 0 }: Option) => {
    const path = href.split('?')[0];
    const active = path === '/deseados' ? pathname === path && china === href.includes('?modo=china') : pathname === path || pathname.startsWith(path + '/');
    return (
      <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
        className={`min-h-[44px] flex items-center gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 font-medium ${active ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
        <Icon aria-hidden="true" className="w-5 h-5 shrink-0" />
        <span>{label}</span>
        {count > 0 && <span className="ml-auto rounded-full bg-red-500 text-white text-xs px-2">{count > 99 ? '99+' : count}</span>}
      </Link>
    );
  };

  return (
    <>
      <header ref={header} className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center px-4">
        <button ref={button} type="button" aria-label="Menú VidaDigital" aria-expanded={open} aria-controls={id}
          onClick={() => setOpen(value => !value)} className="min-h-[44px] font-extrabold text-xl tracking-tight text-blue-600 dark:text-blue-400">
          VidaDigital
        </button>
      </header>
      {open && <nav ref={panel} id={id} aria-label="Menú móvil" className="md:hidden fixed top-16 left-0 right-0 z-40 bg-white dark:bg-zinc-950 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain px-4 pb-4 shadow-lg">
        {groups.filter(group => group.items.length > 0).map((group, index) => (
          <section key={index}>
            {group.title && <h2 className="pt-4 pb-2 text-xs font-semibold uppercase text-zinc-500">{group.title}</h2>}
            {group.items.map(renderLink)}
          </section>
        ))}
        <button type="button" onClick={() => { setOpen(false); void signOut(); }} className="min-h-[44px] mt-4 w-full rounded-md bg-red-600 text-white font-medium px-4 py-3">
          Cerrar sesión
        </button>
      </nav>}
    </>
  );
}
