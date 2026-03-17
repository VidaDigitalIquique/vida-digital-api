'use client';

import * as React from 'react';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import { SessionProvider } from 'next-auth/react';

export function AppShell({ children, session }: { children: React.ReactNode, session: any }) {
  // Try to load active from localStorage, fallback to first empresa
  const [activeEmpresaId, setActiveEmpresaId] = React.useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vidadigital_empresa');
      if (stored) return parseInt(stored, 10);
    }
    return session?.user?.empresas?.[0] || 1;
  });

  const handleSwitch = (id: number) => {
    setActiveEmpresaId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vidadigital_empresa', id.toString());
      window.dispatchEvent(new Event('empresaChanged'));
    }
    // Force a router refresh to refetch server components with the new active enterprise state (if handled via cookies or searchParams later), but client-side state handles it for now.
    window.location.reload(); 
  };

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col pt-16 md:pt-16 pb-16 md:pb-0">
        <TopNav activeEmpresaId={activeEmpresaId} onSwitch={handleSwitch} />
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <BottomNav activeEmpresaId={activeEmpresaId} onSwitch={handleSwitch} />
      </div>
    </SessionProvider>
  );
}
