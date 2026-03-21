'use client';

import { UbicacionBodegaAgrupada } from '@/types';
import { ImageWithFallback } from './ImageWithFallback';

interface BodegaCardProps {
  ubicacion: UbicacionBodegaAgrupada;
  empresaSlug: string;
  onClick: (ubicacion: UbicacionBodegaAgrupada) => void;
}

export function BodegaCard({ ubicacion, empresaSlug, onClick }: BodegaCardProps) {
  const { saldo_total, fisico_total, diferencia_total, cantcaja, umed } = ubicacion;

  const difColor = diferencia_total === null
    ? 'text-zinc-400 dark:text-zinc-600'
    : diferencia_total === 0
      ? 'saldo-zero'
      : diferencia_total < 0
        ? 'saldo-negative'
        : 'saldo-surplus';

  const difLabel = diferencia_total === null
    ? '—'
    : diferencia_total > 0
      ? `+${diferencia_total} ${umed}`
      : diferencia_total < 0
        ? `${diferencia_total} ${umed}`
        : `${diferencia_total} ${umed}`;

  return (
    <div
      className="group relative bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-border shadow-sm rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
      onClick={() => onClick(ubicacion)}
    >
      {/* Top: foto + código + descripción + packing */}
      <div className="flex gap-3 p-3 pb-2">
        <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border self-center">
          <ImageWithFallback
            src={ubicacion.producto_imagen_url}
            codigo={ubicacion.codigo}
            empresaSlug={empresaSlug}
            fill
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            {ubicacion.codigo}
          </div>
          <div className="text-xs font-medium text-foreground leading-snug line-clamp-2" title={ubicacion.detalle || ''}>
            {ubicacion.detalle || 'Sin descripción'}
          </div>
          {cantcaja > 1 && (
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Packing: {cantcaja} {umed}/Caja
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Stats: Saldo Zofri / Físico / Diferencia */}
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <div className="stat-label">Zofri</div>
          <div className="text-sm leading-none saldo-positive">
            {saldo_total} {umed}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <div className="stat-label">Bodega</div>
          <div className={`text-sm leading-none ${fisico_total !== null ? 'saldo-zero' : 'text-zinc-400'}`}>
            {fisico_total !== null ? `${fisico_total} ${umed}` : '—'}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <div className="stat-label">Diferencia</div>
          <div className={`text-sm font-semibold leading-none ${difColor}`}>
            {difLabel}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Ubicaciones */}
      <div className="px-3 py-2">
        <div className="stat-label mb-1.5">Ubicaciones en bodega</div>
        {ubicacion.ubicaciones.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {ubicacion.ubicaciones.map(u => (
              <span
                key={u}
                className="font-mono text-2xl font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg"
              >
                {u}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-zinc-400 italic">Sin ubicación registrada</span>
        )}
      </div>
    </div>
  );
}
