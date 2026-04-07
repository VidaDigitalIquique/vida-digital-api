'use client';

import { Producto } from '@/types';
import { formatUSD } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from './ImageWithFallback';

interface ProductCardProps {
  producto: Producto;
  empresaSlug: string;
  empresaNombre: string;
  onClick: (producto: Producto) => void;
}

const EMPRESA_SHORT: Record<string, { label: string; color: string }> = {
  'IMPORT EXPORT SANJH LTDA.': { label: 'SANJH', color: 'bg-amber-100 text-amber-700' },
  'IMPORT EXPORT VIDA DIGITAL LTDA.': { label: 'VIDA DIGITAL', color: 'bg-teal-100 text-teal-700' },
};

export function ProductCard({ producto, empresaSlug, empresaNombre, onClick }: ProductCardProps) {
  const empresa =
    EMPRESA_SHORT[empresaNombre] ||
    (empresaNombre ? { label: empresaNombre, color: 'bg-zinc-100 text-zinc-600' } : null);
  return (
    <div
      className="group relative bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-border shadow-sm rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md"
      onClick={() => onClick(producto)}
    >
      <div className="flex flex-col p-3 gap-3">

        {/* Top row: imagen + código + descripción */}
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border">
            <ImageWithFallback
              src={producto.imagen_url}
              codigo={producto.codigo}
              empresaSlug={empresaSlug}
              fill
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0 gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                {producto.codigo}
              </span>
              {empresa && (
                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${empresa.color}`}>
                  {empresa.label}
                </Badge>
              )}
              {producto.es_nuevo && (
                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-[10px] px-1.5 py-0 h-4">
                  NUEVO
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-medium leading-snug text-foreground line-clamp-3" title={producto.detalle || ''}>
              {producto.detalle || 'Sin descripción'}
            </h3>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Bottom row: precio + stock */}
        <div className="flex items-stretch gap-0">
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium mb-0.5">Precio venta</div>
            <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
              {formatUSD(producto.prcventa)}
            </div>
          </div>

          <div className="w-px bg-border flex-shrink-0 mx-3" />

          <div className="flex flex-col items-end justify-center gap-1">
            <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium text-right">Saldo Zofri</div>
            <div className={`text-sm font-semibold text-right ${producto.saldo > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`}>
              {producto.saldo} {producto.umed}
            </div>
            {producto.cantcaja > 1 && (
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 text-right leading-none">
                Packing: {producto.cantcaja} {producto.umed}/Caja
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
