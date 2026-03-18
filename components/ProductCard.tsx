'use client';

import { Producto, UserSession } from '@/types';
import { formatUSD } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from './ImageWithFallback';

interface ProductCardProps {
  producto: Producto;
  empresaSlug: string;
  onClick: (producto: Producto) => void;
}

export function ProductCard({ producto, empresaSlug, onClick }: ProductCardProps) {
  return (
    <div 
      className="group relative bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-border shadow-sm rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md"
      onClick={() => onClick(producto)}
    >
      <div className="flex flex-row p-3 gap-3">
        {/* Thumbnail Image */}
        <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <ImageWithFallback 
            src={producto.imagen_url} 
            codigo={producto.codigo} 
            empresaSlug={empresaSlug} 
            fill 
          />
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 min-w-0 justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                {producto.codigo}
              </span>
              {producto.es_nuevo && (
                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-[10px] px-1.5 py-0 h-4">
                  NUEVO
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-medium leading-tight text-foreground line-clamp-2" title={producto.detalle || ''}>
              {producto.detalle || 'Sin descripción'}
            </h3>
          </div>

          <div className="flex items-end justify-between mt-2">
            <div>
              <div className="text-xs text-zinc-500 font-medium">Precio Venta</div>
              <div className="font-bold text-lg leading-none text-zinc-900 dark:text-zinc-100">
                {formatUSD(producto.prcventa)}
              </div>
            </div>
            
            <div className="flex flex-col items-end">
               <Badge variant="outline" className={`text-xs ${producto.saldo > 0 ? 'border-blue-200 text-blue-700 dark:text-blue-400' : 'text-zinc-400'}`}>
                 {producto.saldo} {producto.umed}
               </Badge>
               {producto.cantcaja > 1 && (
                 <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-medium leading-none">
                   {producto.cantcaja} {producto.umed}/Caja
                 </span>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
