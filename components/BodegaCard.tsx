'use client';

import { UbicacionBodega } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from './ImageWithFallback';

interface BodegaCardProps {
  ubicacion: UbicacionBodega & { producto_imagen_url?: string; producto_detalle?: string };
  empresaSlug: string;
  onClick: (ubicacion: UbicacionBodega) => void;
}

export function BodegaCard({ ubicacion, empresaSlug, onClick }: BodegaCardProps) {
  // Format difference badge
  let diffColor = 'bg-zinc-100 text-zinc-500';
  if (ubicacion.diferencia !== null) {
    if (ubicacion.diferencia === 0) diffColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200';
    else if (ubicacion.diferencia < 0) diffColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200';
    else diffColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200';
  }

  return (
    <div 
      className="group relative bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-border shadow-sm rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
      onClick={() => onClick(ubicacion)}
    >
      <div className="flex flex-row p-3 gap-3">
        {/* Info Left */}
        <div className="flex flex-col flex-1 min-w-0 justify-between">
          <div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400 tracking-tight leading-none mb-1">
              {ubicacion.ubicacion || 'Sin Ubicación'}
            </div>
            <div className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {ubicacion.codigo}
            </div>
            {ubicacion.nroingreso && (
              <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tighter -mt-0.5 mb-1">
                Ing: {ubicacion.nroingreso}
              </div>
            )}
            <h3 className="text-xs font-medium text-zinc-500 line-clamp-1" title={ubicacion.producto_detalle || ubicacion.detalle || ''}>
              {ubicacion.producto_detalle || ubicacion.detalle || 'Sin descripción'}
            </h3>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {ubicacion.saldo} un <span className="text-zinc-400 font-normal ml-1">/ {ubicacion.saldocajas ? Number(ubicacion.saldocajas).toFixed(1) : 0} cj</span>
            </div>
            
            {ubicacion.diferencia !== null && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-bold ${diffColor}`}>
                  Dif: {ubicacion.diferencia > 0 ? '+' : ''}{ubicacion.diferencia}
                </Badge>
            )}
          </div>
        </div>

        {/* Thumbnail Image Right */}
        <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 self-center">
          <ImageWithFallback 
            src={ubicacion.producto_imagen_url} 
            codigo={ubicacion.codigo} 
            empresaSlug={empresaSlug} 
            fill 
          />
        </div>
      </div>
    </div>
  );
}
