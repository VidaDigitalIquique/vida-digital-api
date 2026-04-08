'use client';

import { useEffect } from 'react';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { formatUSD } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag } from 'lucide-react';

export function PublicCatalogoClient({ data }: { data: any }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('print=1')) {
      setTimeout(() => window.print(), 800);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <div className="bg-white dark:bg-zinc-900 border-b py-8 px-4 text-center shadow-sm">
        <div className="container max-w-5xl mx-auto space-y-3">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-blue-700 dark:text-blue-400">
            {data.titulo}
          </h1>
          {data.descripcion && (
            <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-lg">
              {data.descripcion}
            </p>
          )}
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-12">
        {!data.productos?.length ? (
          <div className="text-center text-zinc-400 py-20 flex flex-col items-center">
            <ShoppingBag className="w-16 h-16 opacity-20 mb-4" />
            <p className="text-xl">No hay productos disponibles en este catálogo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:block print:space-y-0">
            {data.productos.map((p: any) => (
              <div key={p.id} className="print-page bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group">
                <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
                  <ImageWithFallback
                    src={p.imagen_url}
                    codigo={p.codigo}
                    empresaSlug={data.empresa_slug}
                    fill
                  />
                  {p.es_nuevo && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-emerald-500 font-bold border-none shadow-sm">NUEVO</Badge>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1 gap-1">
                  <div className="font-mono text-xs text-zinc-500 font-semibold">{p.codigo}</div>
                  <h3 className="font-bold text-base leading-tight line-clamp-2 flex-1">{p.detalle}</h3>
                  {p.cantcaja > 1 && (
                    <div className="text-xs text-zinc-400">Packing: {p.cantcaja} {p.umed}/Caja</div>
                  )}
                  {data.mostrar_precio && p.precio_catalogo !== null && (
                    <div className="mt-2">
                      <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Precio</div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">
                        {formatUSD(p.precio_catalogo)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="catalogo-footer text-center py-12 text-zinc-400 text-sm px-4">
        <a href="https://wa.me/56920948874" target="_blank" rel="noopener noreferrer">
          Servicios Digitales PBT<br />
          Software a Medida para Que Su Empresa Venda Más
        </a>
      </div>
    </div>
  );
}
