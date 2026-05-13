'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FileText, UserPlus, Heart, Package, Wallet, Banknote, Users, Phone, ShieldCheck } from 'lucide-react';
import { useAlertas } from '@/contexts/AlertasContext';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import flags from '@/config/feature-flags.json';

export function Toolbar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modoChina = searchParams.get('modo') === 'china';
  const { alertasCount, stockBajoCount, seguimientosCount } = useAlertas();
  const { data: session } = useSession();
  const rol = (session?.user as any)?.rol as string;

  const btn = (active: boolean) => cn(
    'flex items-center gap-1.5 px-3 py-2 rounded-md text-base font-medium uppercase transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900',
    active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'
  );

  return (
    <div className="hidden md:flex w-full border-b border-zinc-100 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70">
      <div className="flex items-center gap-1 max-w-7xl mx-auto px-4 py-1 w-full">
        <Link href="/prenotas" className={btn(pathname.startsWith('/prenotas'))}>
          <FileText className="w-4 h-4" /><span>Pre-notas</span>
        </Link>
        <Link href="/clientes-nuevos" className={btn(pathname.startsWith('/clientes-nuevos'))}>
          <UserPlus className="w-4 h-4" /><span>Clientes Nuevos</span>
        </Link>
        <Link href="/deseados" className={cn(btn(pathname.startsWith('/deseados') && !modoChina), 'relative')}>
          <Heart className="w-4 h-4" /><span>Deseados</span>
          {alertasCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-3.5 flex items-center justify-center px-0.5 leading-none">
              {alertasCount > 99 ? '99+' : alertasCount}
            </span>
          )}
        </Link>
        <Link href="/deseados?modo=china" className={cn(btn(pathname.startsWith('/deseados') && modoChina), 'relative')}>
          <Package className="w-4 h-4" /><span>China</span>
          {stockBajoCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-3.5 flex items-center justify-center px-0.5 leading-none">
              {stockBajoCount > 99 ? '99+' : stockBajoCount}
            </span>
          )}
        </Link>
        {isAdmin && (
          <>
            <Link href="/pettycash" className={btn(pathname.startsWith('/pettycash'))}>
              <Wallet className="w-4 h-4" /><span>Pettycash</span>
            </Link>
            <Link href="/deudas" className={btn(pathname.startsWith('/deudas'))}>
              <Banknote className="w-4 h-4" /><span>Deudas</span>
            </Link>
            <Link href="/sueldos" className={btn(pathname.startsWith('/sueldos'))}>
              <Users className="w-4 h-4" /><span>Sueldos</span>
            </Link>
          </>
        )}
        {flags['seguimientos'] && (isAdmin || rol === 'vendedor') && (
          <Link href="/seguimientos" className={cn(btn(pathname.startsWith('/seguimientos')), 'relative')}>
            <Phone className="w-4 h-4" /><span>Seguimientos</span>
            {seguimientosCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-3.5 flex items-center justify-center px-0.5 leading-none">
                {seguimientosCount > 99 ? '99+' : seguimientosCount}
              </span>
            )}
          </Link>
        )}
        {(isAdmin || rol === 'vendedor') && (
          <Link href="/garantias" className={btn(pathname.startsWith('/garantias'))}>
            <ShieldCheck className="w-4 h-4" /><span>GARANTÍAS</span>
          </Link>
        )}
      </div>
    </div>
  );
}
