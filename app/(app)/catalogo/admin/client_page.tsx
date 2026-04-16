'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Search, Trash2, Link as LinkIcon, ExternalLink, FileDown, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import dynamic from 'next/dynamic';
const QRCodeSVG = dynamic(() => import('qrcode.react').then(mod => mod.QRCodeSVG), { ssr: false });

export function CatalogoAdminClient({ session }: { session: any }) {
  const { empresaId: activeEmpresaId, isLoaded } = useEmpresaId();
  const [catalogos, setCatalogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- Estado modal edición ---
  const [editingCatalog, setEditingCatalog] = useState<any | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const editItemsOriginalRef = useRef<any[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAmbasEmpresas, setNewAmbasEmpresas] = useState(true);
  const [newSoloStock, setNewSoloStock] = useState(false);
  const [newSoloNuevo, setNewSoloNuevo] = useState(false);
  const [newMostrarPrecio, setNewMostrarPrecio] = useState(true);
  const [newMargen, setNewMargen] = useState(0);
  const [newPalabrasIncluir, setNewPalabrasIncluir] = useState('');
  const [newPalabrasExcluir, setNewPalabrasExcluir] = useState('');
  const [newCategoria, setNewCategoria] = useState('');
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([]);

  const fetchCatalogos = async () => {
    if (!activeEmpresaId || activeEmpresaId === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/catalogos?empresa=${activeEmpresaId}`);
      if (res.ok) {
        const { data } = await res.json();
        setCatalogos(data || []);
      }
    } catch {
      toast.error('Error cargando catálogos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/categorias')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCategoriasDisponibles(data.map((c: any) => c.nombre));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoaded || !activeEmpresaId || activeEmpresaId === 0) return;
    fetchCatalogos();
  }, [activeEmpresaId, isLoaded]);

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

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/catalogos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeEmpresaId,
          titulo: newTitle,
          descripcion: newDesc,
          mostrar_precio: newMostrarPrecio,
          margen_precio: newMargen,
          solo_stock: newSoloStock,
          ambas_empresas: newAmbasEmpresas,
          solo_nuevo: newSoloNuevo,
          palabras_incluir: newPalabrasIncluir,
          palabras_excluir: newPalabrasExcluir,
          categoria: newCategoria || null,
        }),
      });
      if (res.ok) {
        toast.success('Catálogo creado');
        setIsCreating(false);
        setNewTitle('');
        setNewDesc('');
        setNewAmbasEmpresas(true);
        setNewSoloStock(false);
        setNewSoloNuevo(false);
        setNewMostrarPrecio(true);
        setNewMargen(0);
        setNewPalabrasIncluir('');
        setNewPalabrasExcluir('');
        setNewCategoria('');
        fetchCatalogos();
      } else throw new Error();
    } catch {
      toast.error('No se pudo crear el catálogo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este catálogo?')) return;
    try {
      const res = await fetch(`/api/catalogos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Eliminado correctamente');
        setCatalogos(prev => prev.filter(c => c.id !== id));
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // --- Funciones edición ---

  const handleOpenEdit = async (cat: any) => {
    setEditingCatalog(cat);
    setEditItems([]);
    setEditLoading(true);
    try {
      const res = await fetch(`/api/catalogos/public/${cat.slug}`);
      if (res.ok) {
        const { data } = await res.json();
        setEditItems(data.productos || []);
        editItemsOriginalRef.current = data.productos || [];
      } else {
        toast.error('Error al cargar productos del catálogo');
        setEditingCatalog(null);
      }
    } catch {
      toast.error('Error al cargar productos del catálogo');
      setEditingCatalog(null);
    } finally {
      setEditLoading(false);
    }
  };

  const handleRemoveItem = (productoId: string) => {
    setEditItems(prev => prev.filter(item => item.codigo !== productoId));
  };

  const handleSaveEdit = async () => {
    if (!editingCatalog) return;
    setEditSaving(true);
    try {
      // Códigos que quedaron en el listado
      const codigosRestantes = new Set(editItems.map(p => p.codigo.toUpperCase()));
      
      // Códigos originales que fueron eliminados por el usuario
      const codigosEliminados = editItemsOriginalRef.current
        .map(p => p.codigo.toUpperCase())
        .filter(c => !codigosRestantes.has(c));

      // Combinar con palabras_excluir existentes del catálogo
      const excluirActual = editingCatalog.palabras_excluir
        ? editingCatalog.palabras_excluir.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      
      const nuevasExclusiones = Array.from(
        new Set([...excluirActual, ...codigosEliminados])
      ).join(', ');

      const res = await fetch(`/api/catalogos/${editingCatalog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palabras_excluir: nuevasExclusiones }),
      });
      if (res.ok) {
        toast.success('Catálogo actualizado');
        setEditingCatalog(null);
        setEditItems([]);
        editItemsOriginalRef.current = [];
        fetchCatalogos();
      } else {
        toast.error('Error al guardar cambios');
      }
    } catch {
      toast.error('Error al guardar cambios');
    } finally {
      setEditSaving(false);
    }
  };

  const getPublicUrl = (slug: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/catalogo/${slug}`;
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Catálogos Personalizados</h1>
          <p className="text-zinc-500 mt-1">Crea listas de productos para compartir con clientes</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
          <PlusCircle className="w-5 h-5 mr-2" />
          Nuevo Catálogo
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">Cargando...</div>
      ) : catalogos.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center bg-zinc-50 dark:bg-zinc-900/50">
           <h3 className="text-lg font-bold mb-2">No tienes catálogos</h3>
           <p className="text-zinc-500 mb-4">Crea tu primer catálogo para agrupar productos y compartirlos.</p>
           <Button onClick={() => setIsCreating(true)} variant="outline">Crear Nuevo</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalogos.map(cat => (
            <div key={cat.id} className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-lg leading-tight line-clamp-1" title={cat.titulo}>{cat.titulo}</h3>
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${cat.activo ? 'bg-emerald-500' : 'bg-red-500'}`} title={cat.activo ? 'Activo' : 'Inactivo'} />
                </div>
                <p className="text-sm text-zinc-500 line-clamp-2 mb-4 h-10">{cat.descripcion || 'Sin descripción'}</p>

                {/* QR centrado */}
                <div className="flex flex-col items-center gap-2 mb-4">
                  <div data-qr={cat.slug} className="bg-white p-2 rounded-lg border shadow-sm">
                    <QRCodeSVG value={getPublicUrl(cat.slug)} size={96} level="M" />
                  </div>
                  <button onClick={() => downloadQR(cat.slug)} className="text-xs text-blue-600 hover:underline">
                    Descargar QR
                  </button>
                </div>

                {/* Slug copiable */}
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 flex items-center justify-between mb-2">
                  <span className="truncate mr-2">.../catalogo/{cat.slug}</span>
                  <button onClick={() => {
                    window.navigator.clipboard.writeText(getPublicUrl(cat.slug));
                    toast.success('Enlace copiado');
                  }} className="p-1 hover:text-blue-500 flex-shrink-0">
                    <LinkIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t pt-4 mt-2">
                <Button variant="outline" className="flex-1 text-xs" onClick={() => window.open(getPublicUrl(cat.slug), '_blank')}>
                  <ExternalLink className="w-3 h-3 mr-2" /> Ver
                </Button>
                <Button variant="outline" className="flex-1 text-xs" onClick={() => window.open(getPublicUrl(cat.slug) + '?print=1', '_blank')}>
                  <FileDown className="w-3 h-3 mr-2" /> PDF
                </Button>
                {cat.user_id === (session?.user as any)?.id && (
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => handleOpenEdit(cat)}
                  >
                    <Pencil className="w-3 h-3 mr-2" /> Editar
                  </Button>
                )}
                <Button variant="destructive" size="icon" onClick={() => handleDelete(cat.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:mx-4 overflow-y-auto p-5 rounded-none sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Nuevo Catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título Comercial</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ej: Ofertas Mayo 2026" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría (Opcional)</label>
              <select
                value={newCategoria}
                onChange={e => setNewCategoria(e.target.value)}
                className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
              >
                <option value="">Sin filtro de categoría</option>
                {categoriasDisponibles.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción (Opcional)</label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Breve mensaje para el cliente" />
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Filtros de productos</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newAmbasEmpresas} onChange={e => setNewAmbasEmpresas(e.target.checked)} className="w-4 h-4 rounded" />
                Incluir productos de ambas empresas
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newSoloStock} onChange={e => setNewSoloStock(e.target.checked)} className="w-4 h-4 rounded" />
                Solo productos con stock
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newSoloNuevo} onChange={e => setNewSoloNuevo(e.target.checked)} className="w-4 h-4 rounded" />
                Solo productos nuevos ✨
              </label>
              <div className="space-y-1">
                <label className="text-sm font-medium">Incluir solo si contiene (separar con coma)</label>
                <Input value={newPalabrasIncluir} onChange={e => setNewPalabrasIncluir(e.target.value)} placeholder="Ej: vidrio, licuadora" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Excluir si contiene (separar con coma)</label>
                <Input value={newPalabrasExcluir} onChange={e => setNewPalabrasExcluir(e.target.value)} placeholder="Ej: NAVIDAD, (ANIL)" />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Configuración de precio</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newMostrarPrecio} onChange={e => setNewMostrarPrecio(e.target.checked)} className="w-4 h-4 rounded" />
                Mostrar precio en el catálogo
              </label>
              {newMostrarPrecio && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Margen sobre costo (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    value={newMargen}
                    onChange={e => setNewMargen(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 30"
                  />
                  <p className="text-xs text-zinc-400">Precio = Costo × (1 + margen%)</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsCreating(false)}>Cancelar</Button>
             <Button onClick={handleCreate} disabled={!newTitle.trim()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal edición de productos */}
      <Dialog open={!!editingCatalog} onOpenChange={(open) => { if (!open) { setEditingCatalog(null); setEditItems([]); } }}>
        <DialogContent className="w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:mx-4 overflow-y-auto p-5 rounded-none sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Editar catálogo: {editingCatalog?.titulo}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {editLoading ? (
              <div className="py-8 text-center text-zinc-500 animate-pulse">Cargando productos...</div>
            ) : editItems.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-sm">
                No hay productos en este catálogo.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {editItems.map((item) => (
                  <li
                    key={item.codigo}
                    className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3"
                  >
                    {item.imagen_url ? (
                      <img
                        src={item.imagen_url}
                        alt={item.detalle}
                        className="w-10 h-10 object-cover rounded-md flex-shrink-0 border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md flex-shrink-0 border bg-zinc-200 dark:bg-zinc-700" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-2">
                        {item.detalle || 'Sin nombre'}
                      </p>
                      {item.precio_catalogo != null && (
                        <p className="text-xs text-zinc-500 mt-0.5">${item.precio_catalogo}</p>
                      )}
                    </div>
                    <button
                      aria-label="Eliminar producto"
                      onClick={() => handleRemoveItem(item.codigo)}
                      className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingCatalog(null); setEditItems([]); }} disabled={editSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving || editLoading}>
              {editSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
