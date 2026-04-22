'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Search, PlusCircle, Trash2, ExternalLink, FileDown, Link as LinkIcon, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ClienteStars } from '@/components/ClienteStars';

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false });

type ClienteBusqueda = {
  kcodclie: string;
  nombress: string;
};

type CatalogoCliente = {
  id: number;
  slug: string;
  titulo: string;
  descripcion: string | null;
  kcodclie: string;
  tipo_precio: string;
  solo_stock: boolean;
  mostrar_precio: boolean;
  margen_precio: number;
  created_at: string;
};

export function CatalogoClientesClient({ session }: { session: any }) {
  void session;
  const { empresaId: activeEmpresaId } = useEmpresaId();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [clientes, setClientes] = useState<ClienteBusqueda[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteBusqueda | null>(null);

  const [catalogos, setCatalogos] = useState<CatalogoCliente[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [newTitulo, setNewTitulo] = useState('');
  const [newTipoPrecio, setNewTipoPrecio] = useState('max');
  const [newSoloStock, setNewSoloStock] = useState(true);
  const [newMostrarPrecio, setNewMostrarPrecio] = useState(true);
  const [newMargen, setNewMargen] = useState(0);
  const [newAmbasEmpresas, setNewAmbasEmpresas] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Buscar clientes
  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      setClientes([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    fetch(`/api/ventas/clientes?q=${encodeURIComponent(debouncedSearch.trim())}&empresaSlug=vida`)
      .then(res => res.ok ? res.json() : { data: [] })
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  const fetchCatalogos = useCallback(async () => {
    if (!selectedCliente) return;
    setLoadingCatalogos(true);
    try {
      const res = await fetch('/api/catalogos/cliente');
      if (res.ok) {
        const { data } = await res.json();
        setCatalogos((data || []).filter((c: CatalogoCliente) => c.kcodclie === selectedCliente.kcodclie));
      }
    } catch {
      toast.error('Error cargando catálogos');
    } finally {
      setLoadingCatalogos(false);
    }
  }, [selectedCliente]);

  useEffect(() => {
    if (!selectedCliente) {
      setCatalogos([]);
      return;
    }
    fetchCatalogos();
  }, [selectedCliente, fetchCatalogos]);

  const handleCrear = async () => {
    if (!selectedCliente) return;
    try {
      const res = await fetch('/api/catalogos/cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeEmpresaId,
          titulo: newTitulo,
          kcodclie: selectedCliente.kcodclie,
          tipo_precio: newTipoPrecio,
          solo_stock: newSoloStock,
          mostrar_precio: newMostrarPrecio,
          margen_precio: newMargen,
          ambas_empresas: newAmbasEmpresas,
        }),
      });
      if (res.ok) {
        toast.success('Catálogo creado');
        setIsCreating(false);
        setNewTitulo('');
        setNewTipoPrecio('max');
        setNewSoloStock(true);
        setNewMostrarPrecio(true);
        setNewMargen(0);
        setNewAmbasEmpresas(true);
        fetchCatalogos();
      } else {
        const { error } = await res.json();
        toast.error(error || 'Error al crear catálogo');
      }
    } catch {
      toast.error('Error al crear catálogo');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este catálogo?')) return;
    try {
      const res = await fetch(`/api/catalogos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCatalogos(prev => prev.filter(c => c.id !== id));
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const getPublicUrl = (slug: string) => `${window.location.origin}/catalogo/clientes/${slug}`;

  const downloadQR = (slug: string) => {
    const svgEl = document.querySelector(`[data-qr="${slug}"] svg`) as SVGElement;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 256, 256);
      const a = document.createElement('a');
      a.download = `qr-${slug}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Catálogos por Cliente</h1>
        <p className="text-zinc-500 mt-1">Genera catálogos personalizados con el historial de compras de cada cliente</p>
      </div>

      {/* Buscador de cliente */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setSelectedCliente(null); }}
          placeholder="Buscar cliente por nombre..."
          className="pl-9"
        />
      </div>

      {/* Resultados de búsqueda */}
      {!selectedCliente && debouncedSearch.length >= 2 && (
        <div className="border rounded-xl overflow-hidden max-w-md">
          {searching ? (
            <div className="p-4 text-sm text-zinc-500 animate-pulse">Buscando...</div>
          ) : clientes.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">Sin resultados</div>
          ) : (
            clientes.map(c => (
              <button
                key={c.kcodclie}
                onClick={() => { setSelectedCliente(c); setSearch(c.nombress); setClientes([]); }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b last:border-0 transition-colors"
              >
                <div className="font-medium text-sm">{c.nombress}</div>
                <div className="text-xs text-zinc-400 font-mono">{c.kcodclie}</div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Panel del cliente seleccionado */}
      {selectedCliente && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{selectedCliente.nombress}</span>
                  <ClienteStars kcodclie={selectedCliente.kcodclie} />
                </div>
                <div className="text-xs text-zinc-400 font-mono">{selectedCliente.kcodclie}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setSelectedCliente(null); setSearch(''); }}>
                Cambiar cliente
              </Button>
              <Button size="sm" onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                <PlusCircle className="w-4 h-4 mr-1" /> Nuevo catálogo
              </Button>
            </div>
          </div>

          {/* Grid de catálogos */}
          {loadingCatalogos ? (
            <div className="py-8 text-center text-zinc-500 animate-pulse">Cargando catálogos...</div>
          ) : catalogos.length === 0 ? (
            <div className="border border-dashed rounded-xl p-8 text-center bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-zinc-500 text-sm">No hay catálogos para este cliente.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setIsCreating(true)}>
                Crear primer catálogo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogos.map(cat => (
                <div key={cat.id} className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg leading-tight line-clamp-1">{cat.titulo}</h3>
                    </div>
                    <div className="text-xs text-zinc-400 mb-3">
                      {cat.tipo_precio === 'max' && 'Precio: máximo histórico'}
                      {cat.tipo_precio === 'min' && 'Precio: mínimo histórico'}
                      {cat.tipo_precio === 'ultimo' && 'Precio: último pagado'}
                      {cat.tipo_precio === 'costo_mas_margen' && `Precio: costo + ${cat.margen_precio}%`}
                      {cat.tipo_precio === 'sin_precio' && 'Sin precio'}
                      {' · '}
                      {cat.solo_stock ? 'Solo con stock' : 'Todos los productos'}
                    </div>
                    <div className="flex flex-col items-center gap-2 mb-4">
                      <div data-qr={cat.slug} className="bg-white p-2 rounded-lg border shadow-sm">
                        <QRCodeSVG value={getPublicUrl(cat.slug)} size={96} level="M" />
                      </div>
                      <button onClick={() => downloadQR(cat.slug)} className="text-xs text-blue-600 hover:underline">
                        Descargar QR
                      </button>
                    </div>
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 flex items-center justify-between mb-2">
                      <span className="truncate mr-2">.../catalogo/clientes/{cat.slug}</span>
                      <button onClick={() => { navigator.clipboard.writeText(getPublicUrl(cat.slug)); toast.success('Enlace copiado'); }}>
                        <LinkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t pt-4 mt-2">
                    <Button variant="outline" className="flex-1 text-xs" onClick={() => window.open(getPublicUrl(cat.slug), '_blank')}>
                      <ExternalLink className="w-3 h-3 mr-2" /> Ver
                    </Button>
                    <Button variant="outline" className="flex-1 text-xs" onClick={() => window.open(getPublicUrl(cat.slug) + '?print=1', '_blank')}>
                      <FileDown className="w-3 h-3 mr-2" /> PDF
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(cat.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog crear catálogo */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="w-full h-full sm:h-auto sm:max-w-md sm:max-h-[90vh] overflow-y-auto p-5 rounded-none sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Nuevo catálogo — {selectedCliente?.nombress}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input value={newTitulo} onChange={e => setNewTitulo(e.target.value)} placeholder="Ej: Catálogo Mayo 2026" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de precio</label>
              <select
                value={newTipoPrecio}
                onChange={e => setNewTipoPrecio(e.target.value)}
                className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
              >
                <option value="max">Precio máximo histórico</option>
                <option value="min">Precio mínimo histórico</option>
                <option value="ultimo">Último precio pagado</option>
                <option value="costo_mas_margen">Costo + margen %</option>
                <option value="sin_precio">Sin precio</option>
              </select>
            </div>
            {newTipoPrecio === 'costo_mas_margen' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Margen sobre costo (%)</label>
                <Input
                  type="number" min="0" max="500"
                  value={newMargen}
                  onChange={e => setNewMargen(parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 30"
                />
              </div>
            )}
            <div className="border-t pt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newSoloStock} onChange={e => setNewSoloStock(e.target.checked)} className="w-4 h-4 rounded" />
                Solo productos con stock
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newMostrarPrecio} onChange={e => setNewMostrarPrecio(e.target.checked)} className="w-4 h-4 rounded" />
                Mostrar precio en el catálogo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newAmbasEmpresas} onChange={e => setNewAmbasEmpresas(e.target.checked)} className="w-4 h-4 rounded" />
                Incluir productos de ambas empresas
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={!newTitulo.trim()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
