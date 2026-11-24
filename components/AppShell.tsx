'use client';

import * as React from 'react';
import Link from 'next/link';
import { TopNav } from './TopNav';
import { Toolbar } from './Toolbar';
import { BottomNav } from './BottomNav';
import { MobileNav } from './MobileNav';
import flags from '@/config/feature-flags.json';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { AlertasProvider } from '@/contexts/AlertasContext';

export function AppShell({ children, session }: { children: React.ReactNode, session: Session | null }) {
  const rol = (session?.user as (Session['user'] & { rol?: string }))?.rol;
  const isAdmin = rol === 'admin';
  return (
    <SessionProvider session={session}>
      <AlertasProvider>
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col pt-16 md:pt-16 ${flags['menu-movil-v2'] ? 'md:pb-0' : 'pb-16 md:pb-0'}`}>
          <TopNav />
          {rol !== 'bodeguero' && <Toolbar isAdmin={isAdmin} />}
          {flags['menu-movil-v2'] ? <MobileNav rol={rol} /> : <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl flex items-center px-4">
            <Link href={
              rol === 'bodeguero' ? '/bodega' : '/dashboard'
            } className="font-extrabold text-xl tracking-tight text-blue-600 dark:text-blue-400">
              VidaDigital
            </Link>
          </header>}
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
          {!flags['menu-movil-v2'] && <BottomNav />}
        </div>
      </AlertasProvider>
    </SessionProvider>
  );
}
