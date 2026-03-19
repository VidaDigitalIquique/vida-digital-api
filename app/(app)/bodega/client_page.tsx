'use client';

import { useState, useEffect, useRef } from 'react';
import { LoteBodega, UbicacionBodegaAgrupada } from '@/types';
import { BodegaCard } from '@/components/BodegaCard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { toast } from 'sonner';

import { useEmpresaId } from '@/hooks/useEmpresaId';

export function BodegaClient({ session, empresasMap }: any) {
  const { empresaId: activeEmpresaId, isLoaded } = useEmpresaId();
  const [ubicaciones, setUbicaciones] = useState<UbicacionBodegaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [soloStock, setSoloStock] = useState(false);
  const [soloNuevo, setSoloNuevo] = useState(false);
  
  const [selectedUbi, setSelectedUbi] = useState<UbicacionBodegaAgrupada | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const empresaSlug = empresasMap[activeEmpresaId] || 'sanjh';

  // Autobocus on search input for fast warehouse operations
  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  // Instant search - no debounce needed if backend is fast, but we'll debounce 250ms internally to save DB load
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!isLoaded || activeEmpresaId === 0) return;
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          empresa: activeEmpresaId.toString(),
          ...(search && { search }),
          ...(soloStock && { soloStock: 'true' }),
          ...(soloNuevo && { soloNuevo: 'true' }),
        });
        
        const res = await fetch(`/api/ubicaciones?${queryParams.toString()}`);
        if (res.ok) {
          const { data } = await res.json();
          setUbicaciones(data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, 250);
    
    return () => clearTimeout(timer);
  }, [activeEmpresaId, search, soloStock, soloNuevo, isLoaded]);

  const openDrawer = (ubi: UbicacionBodegaAgrupada) => {
    setSelectedUbi(ubi);
    setDrawerOpen(true);
  };

  const handleLoteUpdated = (updated: LoteBodega) => {
    setSelectedUbi(prev => {
      if (!prev) return prev;
      const lotes = prev.lotes.map(l => l.id === updated.id ? { ...l, ...updated } : l);
      return { ...prev, lotes };
    });
    setUbicaciones(prev => prev.map(u => (
      u.lotes.some(l => l.id === updated.id)
        ? { ...u, lotes: u.lotes.map(l => l.id === updated.id ? { ...l, ...updated } : l) }
        : u
    )));
  };

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      
      <div className="sticky top-16 md:top-20 z-40 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-xl py-3 -mx-4 px-4 sm:mx-0 sm:px-0 border-b md:border-none shadow-sm md:shadow-none">
        <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 block">Búsqueda Rápida</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-blue-500" />
          <Input 
            ref={searchInputRef}
            type="text" 
            placeholder="Buscar UBICACIÓN o CÓDIGO..." 
            className="pl-12 h-14 text-lg font-medium shadow-md border-blue-200 dark:border-blue-900 bg-white dark:bg-zinc-900 focus-visible:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" checked={soloStock} onChange={(e) => setSoloStock(e.target.checked)} />
            Solo con stock ✓
          </label>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" checked={soloNuevo} onChange={(e) => setSoloNuevo(e.target.checked)} />
            Solo nuevos ✨
          </label>
        </div>
        <div className="text-xs text-zinc-500 font-medium mt-3 text-right">
          Mostrando {ubicaciones.length} ubicaciones
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
         {loading && ubicaciones.length === 0 ? (
           <div className="col-span-full py-8 text-center text-zinc-500 animate-pulse">Buscando...</div>
         ) : ubicaciones.length === 0 ? (
           <div className="col-span-full text-center py-12 text-zinc-500">Ninguna ubicación coincide.</div>
         ) : (
           ubicaciones.map(u => (
             <BodegaCard 
               key={u.codigo} 
               ubicacion={u} 
               empresaSlug={empresaSlug} 
               onClick={openDrawer}
             />
           ))
         )}
      </div>

      {/* Edit Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto pb-safe">
          {selectedUbi && (
            <>
              <SheetHeader className="mb-6 border-b pb-4">
                <SheetTitle className="text-2xl font-black text-blue-700 dark:text-blue-400 leading-none">
                  {selectedUbi.codigo}
                </SheetTitle>
                <SheetDescription className="text-left text-sm font-medium mt-1 text-zinc-600">
                  {selectedUbi.detalle || 'Sin descripción'}
                </SheetDescription>
                <div className="text-xs text-zinc-500 mt-2">
                  Saldo total: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedUbi.saldo_total}</span>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                 {/* Image */}
                <div className="w-full h-48 relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 border">
                  <ImageWithFallback 
                    src={selectedUbi.producto_imagen_url} 
                    codigo={selectedUbi.codigo} 
                    empresaSlug={empresaSlug}
                    fill
                    className="object-contain"
                  />
                </div>

                {/* Lotes */}
                <div className="space-y-4">
                  {selectedUbi.lotes.map(lote => (
                    <LoteEditor
                      key={lote.id}
                      lote={lote}
                      onSaved={handleLoteUpdated}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LoteEditor({ lote, onSaved }: { lote: LoteBodega; onSaved: (updated: LoteBodega) => void }) {
  const [open, setOpen] = useState(false);
  const [ubicacion, setUbicacion] = useState(lote.ubicacion || '');
  const [fisico, setFisico] = useState(lote.fisico !== null ? lote.fisico.toString() : '');
  const [observaciones, setObservaciones] = useState(lote.observaciones || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setUbicacion(lote.ubicacion || '');
    setFisico(lote.fisico !== null ? lote.fisico.toString() : '');
    setObservaciones(lote.observaciones || '');
  }, [lote]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/ubicaciones/${lote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ubicacion: ubicacion === '' ? null : ubicacion,
          fisico: fisico === '' ? null : parseFloat(fisico),
          observaciones: observaciones === '' ? null : observaciones,
        }),
      });

      if (!res.ok) throw new Error('Error guardando');
      const { data } = await res.json();
      onSaved({ ...lote, ...data });
      toast.success('Lote actualizado');
      setOpen(false);
    } catch (error) {
      toast.error('No se pudo guardar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900"
        onClick={() => setOpen(v => !v)}
      >
        <div>
          <div className="text-xs text-zinc-500">Lote</div>
          <div className="font-mono font-semibold text-sm">
            {lote.nroingreso || 'Sin Nro Ingreso'}
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          {lote.ubicacion || 'Sin ubicación'}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-3 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md border">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Saldo</Label>
              <div className="text-xl font-bold mt-1">{lote.saldo}</div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md border text-right">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Cajas</Label>
              <div className="text-xl font-bold mt-1">{lote.saldocajas}</div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Label htmlFor={`fisico-${lote.id}`} className="font-bold">Físico (Conteo real)</Label>
            <Input 
              id={`fisico-${lote.id}`} 
              type="number" 
              className="h-12 text-xl font-bold placeholder:font-normal placeholder:text-zinc-300" 
              placeholder="Ej: 45"
              value={fisico}
              onChange={e => setFisico(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`ubicacion-${lote.id}`}>Código de Ubicación</Label>
            <Input 
              id={`ubicacion-${lote.id}`} 
              className="font-mono uppercase" 
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`observaciones-${lote.id}`}>Observaciones</Label>
            <Input 
              id={`observaciones-${lote.id}`} 
              placeholder="Ej: Cajas mojadas, faltan piezas..." 
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
            />
          </div>

          <Button className="w-full h-12 text-lg font-bold mt-2" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      )}
    </div>
  );
}
