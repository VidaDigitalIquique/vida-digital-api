'use client';

import { useState } from 'react';
import { Producto } from '@/types';
import { formatUSD } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from './ImageWithFallback';
import { ClipboardList, Heart, Users } from 'lucide-react';
import { AgregarADeseadosModal } from './AgregarADeseadosModal';
import { AgregarAPrenotaModal } from '@/components/AgregarAPrenotaModal';
import { ClienteStars } from '@/components/ClienteStars';
import { useShareImage } from '@/hooks/useShareImage';

interface ProductCardProps {
  producto: Producto;
  empresaSlug: string;
  empresaNombre: string;
  onClick: (producto: Producto) => void;
  ocultarPrecios?: boolean;
  rol?: string;
}

const EMPRESA_SHORT: Record<string, { label: string; color: string }> = {
  'IMPORT EXPORT SANJH LTDA.': { label: 'SANJH', color: 'bg-amber-100 text-amber-700' },
  'IMPORT EXPORT VIDA DIGITAL LTDA.': { label: 'VIDA DIGITAL', color: 'bg-teal-100 text-teal-700' },
};

export function ProductCard({ producto, empresaSlug, empresaNombre, onClick, ocultarPrecios, rol }: ProductCardProps) {
  const empresa =
    EMPRESA_SHORT[empresaNombre] ||
    (empresaNombre ? { label: empresaNombre, color: 'bg-zinc-100 text-zinc-600' } : null);
  const [deseadoOpen, setDeseadoOpen] = useState(false);
  const [showCompradores, setShowCompradores] = useState(false);
  const [compradores, setCompradores] = useState<any[]>([]);
  const [loadingCompradores, setLoadingCompradores] = useState(false);
  const [compradorActivo, setCompradorActivo] = useState<any | null>(null);
  const [showPrenota, setShowPrenota] = useState(false);
  const { shareImage } = useShareImage();

  const handleVerCompradores = async () => {
    setShowCompradores(true);
    setLoadingCompradores(true);
    try {
      const res = await fetch(`/api/productos/${producto.codigo}/compradores`);
      if (res.ok) {
        const { data } = await res.json();
        setCompradores(data);
      }
    } finally {
      setLoadingCompradores(false);
    }
  };

  const handleWhatsApp = async (comprador: any) => {
    const tel = comprador.celular?.replace(/\D/g, '');
    const texto = encodeURIComponent(`Hola ${comprador.nombre} nos volvió a llegar ${producto.detalle || producto.codigo}`);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const waUrl = isMobile
      ? `whatsapp://send?phone=${tel}&text=${texto}`
      : `https://web.whatsapp.com/send?phone=${tel}&text=${texto}`;
    if (producto.imagen_url) {
      await shareImage(producto.imagen_url, `${producto.codigo}.jpg`, producto.detalle || producto.codigo);
    }
    window.open(waUrl, '_blank');
  };

  return (
    <>
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
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.preventDefault(); e.stopPropagation(); setDeseadoOpen(true); }}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-red-400 flex-shrink-0 ml-auto"
                title="Agregar a deseados"
              >
                <Heart className="w-3.5 h-3.5" />
              </button>
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
              {ocultarPrecios ? '••••' : formatUSD(producto.prcventa)}
            </div>
          </div>

          <div className="w-px bg-border flex-shrink-0 mx-3" />

          <div className="flex flex-col items-end justify-center gap-1">
            <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium text-right">Saldo Zofri</div>
            <div className={`text-sm font-semibold text-right ${producto.saldo > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
              {producto.saldo} {producto.umed}
            </div>
            {producto.cantcaja > 1 && (
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 text-right leading-none">
                Packing: {producto.cantcaja} {producto.umed}/Caja
              </div>
            )}
          </div>
        </div>

        {rol !== 'bodeguero' && (
          <button
            onClick={e => { e.stopPropagation(); handleVerCompradores(); }}
            className="w-full text-xs text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 pt-1 border-t border-border mt-1"
          >
            <Users className="w-3 h-3" />
            Clientes que han comprado
          </button>
        )}

        {rol !== 'bodeguero' && (
          <button
            onClick={e => { e.stopPropagation(); setShowPrenota(true); }}
            className="w-full text-xs text-green-600 hover:text-green-800 flex items-center justify-center gap-1 pt-1 border-t border-border mt-1"
          >
            <ClipboardList className="w-3 h-3" />
            Agregar a Pre-Nota
          </button>
        )}

      </div>
    </div>
    {showCompradores && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCompradores(false)}>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-bold mb-4">Clientes que han comprado — {producto.codigo}</h2>
          {loadingCompradores && <p className="text-zinc-400">Cargando...</p>}
          {!loadingCompradores && compradores.length === 0 && <p className="text-zinc-400">Sin compradores registrados.</p>}
          {compradores.map(c => (
            <button
              key={c.kcodclie}
              onClick={() => setCompradorActivo(c)}
              className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg border border-border mb-2"
            >
              <div className="font-medium">{c.nombre}</div>
              <div className="text-xs text-zinc-400">{c.pais}{c.ciudad ? ` — ${c.ciudad}` : ''} · {c.compras.length} compra{c.compras.length !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      </div>
    )}
    {compradorActivo && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCompradorActivo(null)}>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <button onClick={() => setCompradorActivo(null)} className="text-xs text-zinc-400 mb-3">← Volver</button>
          <div className="flex flex-col gap-1 mb-4">
            <div className="font-bold text-lg">{compradorActivo.nombre}</div>
            <ClienteStars kcodclie={compradorActivo.kcodclie} />
            {compradorActivo.pais && <div className="text-sm text-zinc-500">{compradorActivo.pais}{compradorActivo.ciudad ? ` — ${compradorActivo.ciudad}` : ''}</div>}
            {compradorActivo.celular && (
              <button
                onClick={() => handleWhatsApp(compradorActivo)}
                className="mt-2 flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium"
              >
                 {compradorActivo.celular} — Enviar por WhatsApp
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-zinc-400 border-b border-border"><th className="text-left pb-1">Fecha</th><th className="text-right pb-1">Cant</th><th className="text-right pb-1">Precio</th></tr></thead>
            <tbody>
              {compradorActivo.compras.map((compra: any, i: number) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1">{compra.fecha}</td>
                  <td className="text-right">{compra.cantidad}</td>
                  <td className="text-right">${Number(compra.precio).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    <AgregarADeseadosModal
      open={deseadoOpen}
      onOpenChange={setDeseadoOpen}
      codigo={producto.codigo}
      descripcion={producto.detalle || ''}
    />
    <AgregarAPrenotaModal
      open={showPrenota}
      onClose={() => setShowPrenota(false)}
      producto={producto}
    />
    </>
  );
}
