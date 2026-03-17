'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Building2, Check } from 'lucide-react';

const EMPRESAS = [
  { id: 1, nombre: 'SANJH', slug: 'sanjh', color: 'text-amber-500' },
  { id: 2, nombre: 'VIDA DIGITAL', slug: 'vidadigital', color: 'text-teal-500' },
];

export function CompanySwitcher({ activeEmpresaId, onSwitch }: { activeEmpresaId: number, onSwitch: (id: number) => void }) {
  const active = EMPRESAS.find((e) => e.id === activeEmpresaId) || EMPRESAS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-between gap-2 w-[180px] px-3 py-2 rounded-md border text-sm font-semibold border-none shadow-sm bg-white/50 dark:bg-zinc-900/50 focus:outline-none">
        <div className="flex items-center gap-2">
          <Building2 className={`w-4 h-4 ${active.color}`} />
          <span className="truncate">{active.nombre}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        {EMPRESAS.map((emp) => (
          <DropdownMenuItem
            key={emp.id}
            onClick={() => onSwitch(emp.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2 font-medium">
              <div className={`w-2 h-2 rounded-full ${emp.id === 1 ? 'bg-amber-500' : 'bg-teal-500'}`} />
              {emp.nombre}
            </div>
            {activeEmpresaId === emp.id && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
