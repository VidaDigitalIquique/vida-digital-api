'use client';

import { ImageWithFallback } from '@/components/ImageWithFallback';
import { formatUSD } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag } from 'lucide-react';

export function PublicCatalogoClient({ data }: { data: any }) {
  // data contains: titulo, descripcion, created_at, items[]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Header */}
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

      {/* Grid */}
      <div className="container max-w-6xl mx-auto px-4 py-12">
         {data.items?.length === 0 ? (
           <div className="text-center text-zinc-400 py-20 flex flex-col items-center">
             <ShoppingBag className="w-16 h-16 opacity-20 mb-4" />
             <p className="text-xl">No hay productos en este catálogo actualmente.</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {data.items.map((item: any) => {
               // Render logic differentiating 'producto' vs 'imagen' vs 'video' 
               // For this implementation, we assume basic product items are passed
               if (item.tipo !== 'producto') return null;

               return (
                 <div key={item.id} className="bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group">
                   <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
                      <ImageWithFallback 
                        src={item.producto_imagen_url}
                        codigo={item.producto_codigo}
                        empresaSlug={item.empresa_slug}
                        fill
                      />
                      {item.es_nuevo && (
                        <div className="absolute top-2 left-2 z-10">
                           <Badge className="bg-emerald-500 font-bold border-none shadow-sm">NUEVO</Badge>
                        </div>
                      )}
                   </div>
                   <div className="p-4 flex flex-col flex-1">
                      <div className="font-mono text-xs text-zinc-500 font-semibold mb-1">{item.producto_codigo}</div>
                      <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2">{item.producto_detalle}</h3>
                      
                      <div className="mt-auto pt-4 flex items-end justify-between">
                         {!item.hide_price && (
                           <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Precio</div>
                              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">
                                {formatUSD(item.prcventa)}
                              </div>
                           </div>
                         )}
                         <div className="text-right">
                            {item.saldo > 0 ? (
                               <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                                 Stock Disp.
                               </Badge>
                            ) : (
                               <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                                 Agotado
                               </Badge>
                            )}
                         </div>
                      </div>
                   </div>
                 </div>
               )
             })}
           </div>
         )}
      </div>

      <div className="text-center py-12 text-zinc-400 text-sm">
         Potenciado por <strong>VidaDigital</strong>
      </div>
    </div>
  );
}
