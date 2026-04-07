'use client';

import * as React from 'react';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import { SessionProvider } from 'next-auth/react';

export function AppShell({ children, session }: { children: React.ReactNode, session: any }) {
  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col pt-16 md:pt-16 pb-16 md:pb-0">
        <TopNav />
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </SessionProvider>
  );
}
