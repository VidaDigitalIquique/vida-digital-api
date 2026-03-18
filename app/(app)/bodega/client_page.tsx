'use client';

import { useState, useEffect, useRef } from 'react';
import { UbicacionBodega, UserSession } from '@/types';
import { BodegaCard } from '@/components/BodegaCard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { formatUSD } from '@/lib/utils';
import { toast } from 'sonner';

import { useEmpresaId } from '@/hooks/useEmpresaId';

export function BodegaClient({ session, empresasMap }: any) {
  const { empresaId: activeEmpresaId, isLoaded } = useEmpresaId();
  const [ubicaciones, setUbicaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedUbi, setSelectedUbi] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Edit states
  const [editUbicacionText, setEditUbicacionText] = useState('');
  const [editFisico, setEditFisico] = useState('');
  const [editObs, setEditObs] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
  }, [activeEmpresaId, search, isLoaded]);

  const openDrawer = (ubi: any) => {
    setSelectedUbi(ubi);
    setEditUbicacionText(ubi.ubicacion || '');
    setEditFisico(ubi.fisico !== null ? ubi.fisico.toString() : '');
    setEditObs(ubi.observaciones || '');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUbi) return;
    setIsSaving(true);
    
    try {
      const res = await fetch(`/api/ubicaciones/${selectedUbi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ubicacion: editUbicacionText,
          fisico: editFisico === '' ? null : parseFloat(editFisico),
          observaciones: editObs,
        }),
      });

      if (!res.ok) throw new Error('Error guardando');
      
      const { data } = await res.json();
      
      // Update local list
      setUbicaciones(prev => prev.map(u => u.id === selectedUbi.id ? { ...u, ...data } : u));
      toast.success('Ubicación guardada con éxito');
      setDrawerOpen(false);
    } catch (error) {
       toast.error('No se pudo guardar');
    } finally {
       setIsSaving(false);
    }
  };

  const previewDiferencia = 
    editFisico === '' || isNaN(parseFloat(editFisico)) 
      ? null 
      : parseFloat(editFisico) - (selectedUbi?.saldo || 0);

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
               key={u.id} 
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
                  {selectedUbi.ubicacion || 'Nueva Ubicación'}
                </SheetTitle>
                <div className="font-mono font-bold text-zinc-700 dark:text-zinc-300 mt-2">
                  {selectedUbi.codigo}
                </div>
                <SheetDescription className="text-left text-sm font-medium mt-1 text-zinc-600">
                  {selectedUbi.producto_detalle || selectedUbi.detalle}
                </SheetDescription>
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

                {/* Edit Form */}
                <div className="space-y-4">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md border">
                       <Label className="text-zinc-500 text-xs uppercase tracking-wider">Saldo Sistema</Label>
                       <div className="text-2xl font-bold mt-1">{selectedUbi.saldo}</div>
                    </div>
                    <div className={`p-3 rounded-md border text-right ${previewDiferencia !== null && previewDiferencia !== 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' : 'bg-zinc-50 dark:bg-zinc-900'}`}>
                       <Label className="text-zinc-500 text-xs uppercase tracking-wider">Diferencia</Label>
                       <div className={`text-2xl font-bold mt-1 ${previewDiferencia !== null && previewDiferencia !== 0 ? 'text-amber-600 dark:text-amber-500' : ''}`}>
                         {previewDiferencia !== null ? (previewDiferencia > 0 ? '+' + previewDiferencia : previewDiferencia) : '-'}
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label htmlFor="fisico" className="font-bold">Físico (Conteo real)</Label>
                    <Input 
                      id="fisico" 
                      type="number" 
                      className="h-12 text-xl font-bold placeholder:font-normal placeholder:text-zinc-300" 
                      placeholder="Ej: 45"
                      value={editFisico}
                      onChange={e => setEditFisico(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ubicacion">Código de Ubicación</Label>
                    <Input 
                      id="ubicacion" 
                      className="font-mono uppercase" 
                      value={editUbicacionText}
                      onChange={e => setEditUbicacionText(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observaciones">Observaciones</Label>
                    <Input 
                      id="observaciones" 
                      placeholder="Ej: Cajas mojadas, faltan piezas..." 
                      value={editObs}
                      onChange={e => setEditObs(e.target.value)}
                    />
                  </div>

                  <Button className="w-full h-12 text-lg font-bold mt-4" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
