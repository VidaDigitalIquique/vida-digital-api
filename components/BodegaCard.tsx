'use client';

import { UbicacionBodegaAgrupada } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from './ImageWithFallback';

interface BodegaCardProps {
  ubicacion: UbicacionBodegaAgrupada;
  empresaSlug: string;
  onClick: (ubicacion: UbicacionBodegaAgrupada) => void;
}

export function BodegaCard({ ubicacion, empresaSlug, onClick }: BodegaCardProps) {
  const totalLotes = ubicacion.lotes.length;
  const lotesUbicados = ubicacion.lotes.filter(l => l.ubicacion).length;

  return (
    <div 
      className="group relative bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-border shadow-sm rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
      onClick={() => onClick(ubicacion)}
    >
      <div className="flex flex-row p-3 gap-3">
        {/* Info Left */}
        <div className="flex flex-col flex-1 min-w-0 justify-between">
          <div>
            <div className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {ubicacion.codigo}
            </div>
            <h3 className="text-xs font-medium text-zinc-500 line-clamp-1" title={ubicacion.detalle || ''}>
              {ubicacion.detalle || 'Sin descripción'}
            </h3>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {ubicacion.saldo_total} un
            </div>
            
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-bold">
              {lotesUbicados} / {totalLotes} lotes ubicados
            </Badge>
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
