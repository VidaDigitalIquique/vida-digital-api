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
  const hasSearch = search.trim().length >= 2;
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

  useEffect(() => {
    setSoloStock(localStorage.getItem('bodega_soloStock') === 'true');
    setSoloNuevo(localStorage.getItem('bodega_soloNuevo') === 'true');
  }, []);

  useEffect(() => { localStorage.setItem('bodega_soloStock', soloStock.toString()); }, [soloStock]);
  useEffect(() => { localStorage.setItem('bodega_soloNuevo', soloNuevo.toString()); }, [soloNuevo]);

  // Instant search - no debounce needed if backend is fast, but we'll debounce 250ms internally to save DB load
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!isLoaded || activeEmpresaId === 0) return;
      if (search.trim().length < 2) {
        setUbicaciones([]);
        setLoading(false);
        return;
      }
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

  const buildUpdatedUbi = (base: UbicacionBodegaAgrupada, lotes: LoteBodega[]) => {
    const ubicaciones = Array.from(
      new Set(
        lotes
          .map(l => (l.ubicacion || '').trim())
          .filter(u => u.length > 0)
      )
    );

    const fisicoValues = lotes.map(l => l.fisico);
    const hasFisico = fisicoValues.some(v => v !== null);
    const fisico_total = hasFisico
      ? fisicoValues.reduce((acc, v) => {
        if (acc === null) return acc;
        return acc + (v ?? 0);
      }, 0 as number | null)
      : null;

    const diferenciaValues = lotes.map(l => l.diferencia);
    const hasDiferencia = diferenciaValues.some(v => v !== null);
    const diferencia_total = hasDiferencia
      ? diferenciaValues.reduce((acc, v) => {
        if (acc === null) return acc;
        return acc + (v ?? 0);
      }, 0 as number | null)
      : null;

    return { ...base, lotes, ubicaciones, fisico_total, diferencia_total };
  };

  const handleLoteUpdated = (updated: LoteBodega) => {
    setSelectedUbi(prev => {
      if (!prev) return prev;
      const lotes = prev.lotes.map(l => l.id === updated.id ? { ...l, ...updated } : l);
      return buildUpdatedUbi(prev, lotes);
    });
    setUbicaciones(prev => prev.map(u => (
      u.lotes.some(l => l.id === updated.id)
        ? buildUpdatedUbi(
            u,
            u.lotes.map(l => l.id === updated.id ? { ...l, ...updated } : l)
          )
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
        {hasSearch && (
          <div className="text-xs text-zinc-500 font-medium mt-3 text-right">
            Mostrando {ubicaciones.length} ubicaciones
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
         {loading && hasSearch ? (
           <div className="col-span-full py-8 text-center text-zinc-500 animate-pulse">Buscando...</div>
         ) : !hasSearch ? (
           <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-3">
             <div className="text-4xl"></div>
             <p className="text-zinc-500 font-medium">Busca un producto o ubicación</p>
             <p className="text-zinc-400 text-sm">Ingresa al menos 2 caracteres para ver resultados</p>
           </div>
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
        <SheetContent className="w-screen h-screen sm:w-[500px] sm:h-full max-w-full overflow-y-auto flex flex-col p-0">
          <div className="p-5 flex flex-col h-full overflow-y-auto">
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
                      key={`${lote.id}-${lote.updated_at}`}
                      lote={lote}
                      cantcaja={selectedUbi.cantcaja}
                      onSaved={handleLoteUpdated}
                    />
                  ))}
                </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LoteEditor({ lote, cantcaja, onSaved }: { lote: LoteBodega; cantcaja: number; onSaved: (updated: LoteBodega) => void }) {
  const [open, setOpen] = useState(false);
  const [ubicacion, setUbicacion] = useState(lote.ubicacion || '');
  const [fisicoCanjas, setFisicoCanjas] = useState(() => lote.fisico_cajas != null ? lote.fisico_cajas.toString() : '');
  const [fisicoUnidades, setFisicoUnidades] = useState(() => lote.fisico_unidades != null && lote.fisico_unidades > 0 ? lote.fisico_unidades.toString() : '');
  const [obs, setObs] = useState(lote.observaciones || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUbicacion(lote.ubicacion || '');
    setFisicoCanjas(lote.fisico_cajas != null ? lote.fisico_cajas.toString() : '');
    setFisicoUnidades(lote.fisico_unidades != null && lote.fisico_unidades > 0 ? lote.fisico_unidades.toString() : '');
    setObs(lote.observaciones || '');
  }, [lote]);

  const cajas = fisicoCanjas === '' ? null : parseInt(fisicoCanjas);
  const unidades = fisicoUnidades === '' ? 0 : parseInt(fisicoUnidades);
  const fisicoTotal = cajas !== null ? (cajas * cantcaja) + unidades : null;
  const diferencia = fisicoTotal !== null ? fisicoTotal - lote.saldo : null;
  const difCajas = diferencia !== null ? Math.trunc(diferencia / cantcaja) : null;
  const difResto = diferencia !== null ? diferencia % cantcaja : null;

  const difLabel = diferencia === null
    ? '—'
    : diferencia === 0
      ? 'Cuadrado ✓'
      : difCajas === 0
        ? `${difResto} u`
        : difResto === 0
          ? `${difCajas} cj`
          : `${difCajas} cj + ${difResto} u`;

  const difColor = diferencia === null
    ? 'text-zinc-400'
    : diferencia === 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : diferencia < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-amber-600 dark:text-amber-400';

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ubicacion,
        fisico_cajas: cajas,
        fisico_unidades: unidades,
        observaciones: obs,
      };
      const res = await fetch(`/api/ubicaciones/${lote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error guardando');
      const { data } = await res.json();
      onSaved({ ...lote, ...data, ubicacion: payload.ubicacion, observaciones: payload.observaciones });
      toast.success('Lote guardado');
      setOpen(false);
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const saldoCajas = Math.floor(lote.saldo / cantcaja);
  const saldoResto = lote.saldo % cantcaja;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div>
          <div className="text-[10px] font-mono text-zinc-400 uppercase">{lote.nroingreso || 'Sin Nro Ingreso'}</div>
          <div className="text-lg font-black text-blue-700 dark:text-blue-400 leading-none mt-0.5">
            {lote.ubicacion || <span className="text-zinc-300 font-normal text-sm">Sin ubicación</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">{saldoCajas} cj {saldoResto > 0 ? `+ ${saldoResto} u` : ''}</div>
          {diferencia !== null && (
            <div className={`text-xs font-bold ${difColor}`}>{difLabel}</div>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t p-4 space-y-3 bg-zinc-50 dark:bg-zinc-900">
          
          {/* Saldo sistema */}
          <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg border text-center">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Saldo sistema</div>
            <div className="text-2xl font-bold mt-0.5">{saldoCajas} cj {saldoResto > 0 ? `+ ${saldoResto} u` : ''}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{lote.saldo} unidades · {cantcaja} u/caja</div>
          </div>

          {/* Conteo físico */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Físico</Label>
              <Input
                type="number"
                min="0"
                className="h-12 text-xl font-bold text-center"
                placeholder="0"
                value={fisicoCanjas}
                onChange={e => setFisicoCanjas(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Unidades sueltas</Label>
              <Input
                type="number"
                min="0"
                className="h-12 text-xl font-bold text-center"
                placeholder="0"
                value={fisicoUnidades}
                onChange={e => setFisicoUnidades(e.target.value)}
              />
            </div>
          </div>

          {/* Preview diferencia */}
          {fisicoTotal !== null && (
            <div className={`p-3 rounded-lg border text-center ${diferencia === 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200' : diferencia! < 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200'}`}>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Diferencia</div>
              <div className={`text-xl font-bold mt-0.5 ${difColor}`}>{difLabel}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{fisicoTotal} u físicas vs {lote.saldo} u sistema</div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Código de ubicación</Label>
            <Input className="font-mono uppercase" value={ubicacion} onChange={e => setUbicacion(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observaciones</Label>
            <Input placeholder="Ej: Cajas mojadas..." value={obs} onChange={e => setObs(e.target.value)} />
          </div>
          <Button className="w-full font-bold h-11" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar lote'}
          </Button>
        </div>
      )}
    </div>
  );
}
