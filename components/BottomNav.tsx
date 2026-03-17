'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Tag, Box, Camera, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { CompanySwitcher } from './CompanySwitcher';
import { signOut } from 'next-auth/react';
import { Button } from './ui/button';

const NAV_LINKS = [
  { name: 'Precios', href: '/precios', icon: Tag },
  { name: 'Bodega', href: '/bodega', icon: Box },
  { name: 'Despachos', href: '/despachos', icon: Camera },
];

export function BottomNav({ activeEmpresaId, onSwitch }: { activeEmpresaId: number, onSwitch: (id: number) => void }) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl pb-safe">
      <div className="flex items-center justify-around h-full px-2">
        <Link href="/dashboard" className={cn("flex flex-col items-center justify-center w-full h-full gap-1 transition-colors", pathname === '/dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100')}>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Inicio</span>
        </Link>
        
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={cn("flex flex-col items-center justify-center w-full h-full gap-1 transition-colors", isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100')}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{link.name}</span>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger className="flex flex-col items-center justify-center w-full h-full gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none">
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Más</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-[80vw] sm:w-[350px] p-6">
            <div className="flex justify-between flex-col h-full pt-10">
               <div className="space-y-6">
                 <div>
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Empresa Activa</h3>
                    <CompanySwitcher activeEmpresaId={activeEmpresaId} onSwitch={onSwitch} />
                 </div>
                 <div>
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Herramientas</h3>
                    <Link href="/inventario" className="block py-2 font-medium">Inventario / Conteo</Link>
                    <Link href="/catalogo/admin" className="block py-2 font-medium">Mis Catálogos</Link>
                 </div>
                 <div>
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Administración</h3>
                    <Link href="/admin/importar" className="block py-2 font-medium">Importar Excel</Link>
                    <Link href="/admin/usuarios" className="block py-2 font-medium">Usuarios</Link>
                 </div>
               </div>
               <Button variant="destructive" onClick={() => signOut()} className="w-full">
                 Cerrar Sesión
               </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
