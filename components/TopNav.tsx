'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Tag, 
  Box, 
  LogOut, 
  ChevronDown, 
  FileSpreadsheet, 
  Users, 
  LayoutList 
} from 'lucide-react';
import { CompanySwitcher } from './CompanySwitcher';

const NAV_LINKS = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Precios', href: '/precios', icon: Tag },
  { name: 'Bodega', href: '/bodega', icon: Box },
  { name: 'Catálogos', href: '/catalogo/admin', icon: LayoutList },
];

export function TopNav({ activeEmpresaId, onSwitch }: { activeEmpresaId: number, onSwitch: (id: number) => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.rol === 'admin';
  const rol = (session?.user as any)?.rol as string;

  const RUTAS_POR_ROL: Record<string, string[]> = {
    admin: ['/dashboard', '/precios', '/bodega', '/catalogo'],
    vendedor: ['/precios', '/catalogo'],
    bodeguero: ['/bodega'],
  };

  const rutasVisibles = RUTAS_POR_ROL[rol] || [];
  const visibleLinks = NAV_LINKS.filter(link => 
    rutasVisibles.some(ruta => link.href.startsWith(ruta))
  );

  return (
    <header className="hidden md:flex sticky top-0 z-50 w-full h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl transition-all">
      <div className="container flex h-16 max-w-7xl items-center justify-between mx-auto px-4">
        <div className="flex items-center gap-8">
          <Link href={rutasVisibles[0] || '/dashboard'} className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">
            VidaDigital
          </Link>
          <nav className="flex items-center space-x-1">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900',
                    isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.name}
                </Link>
              );
            })}

            {/* Admin Only Links */}
            {isAdmin && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none',
                    pathname.startsWith('/admin') ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'
                  )}>
                    Administración <ChevronDown className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>
                      <Link href="/admin/importar" className="flex items-center gap-2 w-full">
                        <FileSpreadsheet className="w-4 h-4" /> Importar Excel
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/admin/usuarios" className="flex items-center gap-2 w-full">
                        <Users className="w-4 h-4" /> Usuarios
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <CompanySwitcher activeEmpresaId={activeEmpresaId} onSwitch={onSwitch} />
          <button onClick={() => signOut()} className="p-2 text-zinc-500 hover:text-red-500 transition-colors" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
