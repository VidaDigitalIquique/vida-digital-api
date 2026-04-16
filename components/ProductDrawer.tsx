'use client';

import { useState, useRef, useEffect } from 'react';
import { Producto, UserSession } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ImageWithFallback } from './ImageWithFallback';
import { formatUSD } from '@/lib/utils';
import { toast } from 'sonner';
import { Share2 } from 'lucide-react';
import { useShareImage } from '@/hooks/useShareImage';
import { Badge } from '@/components/ui/badge';

interface ProductDrawerProps {
  producto: Producto | null;
  empresaNombre: string;
  session: UserSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updatedProduct: Producto) => void;
  ocultarPrecios?: boolean;
}

const EMPRESA_SHORT: Record<string, { label: string; color: string }> = {
  'IMPORT EXPORT SANJH LTDA.': { label: 'SANJH', color: 'bg-amber-100 text-amber-700' },
  'IMPORT EXPORT VIDA DIGITAL LTDA.': { label: 'VIDA DIGITAL', color: 'bg-teal-100 text-teal-700' },
};

const EMPRESA_SLUG: Record<string, string> = {
  'IMPORT EXPORT SANJH LTDA.': 'sanjh',
  'IMPORT EXPORT VIDA DIGITAL LTDA.': 'vidadigital',
};


export function ProductDrawer({ producto, empresaNombre, session, open, onOpenChange, onUpdated, ocultarPrecios }: ProductDrawerProps) {
  const { shareImage } = useShareImage();
  const [isEditing, setIsEditing] = useState(false);
  const [prcVenta, setPrcVenta] = useState('');
  const [prcMinimo, setPrcMinimo] = useState('');
  const [categoria, setCategoria] = useState(producto?.categoria ?? '');
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [kardex, setKardex] = useState<{
    precio_minimo: number | null;
    precio_maximo: number | null;
    precio_medio: number | null;
    precio_medio_status: string;
    total_ventas: number;
    clientes_excluidos: number;
  } | null>(null);
  const [kardexLoading, setKardexLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const skipNextSync = useRef(false);
  const empresaSlug = EMPRESA_SLUG[empresaNombre] || 'sanjh';
  const empresa =
    EMPRESA_SHORT[empresaNombre] ||
    (empresaNombre ? { label: empresaNombre, color: 'bg-zinc-100 text-zinc-600' } : null);

  const canEditPrices = ['admin', 'supervisor'].includes(session.rol);
  const isAdmin = session.rol === 'admin';

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
    if (producto) {
      setCategoria(producto.categoria ?? '');
    }
  }, [producto]);

  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    setCurrentImageUrl(producto?.imagen_url || null);
  }, [producto]);

  useEffect(() => {
    if (open && producto) {
      setKardexLoading(true);
      setKardex(null);
      fetch(`/api/kardex?codigo=${encodeURIComponent(producto.codigo)}&empresaSlug=${encodeURIComponent(empresaSlug)}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => { if (data) setKardex(data); })
        .catch(() => setKardex(null))
        .finally(() => setKardexLoading(false));
    }
    if (!open) {
      setKardex(null);
      setKardexLoading(false);
    }
  }, [open, producto?.codigo]);

  // Sync state when product opens
  const handleOpenStatus = (isOpen: boolean) => {
    if (isOpen && producto) {
      setPrcVenta(producto.prcventa.toString());
      setPrcMinimo(producto.prcminimo.toString());
      setCategoria(producto.categoria ?? '');
      setIsEditing(false);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    onOpenChange(isOpen);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Solo se aceptan JPG, PNG o WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagen debe ser menor a 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !producto) return;
    setIsUploading(true);
    
    try {
      // 1. Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(selectedFile);
      const base64Data = await base64Promise;

      // 2. Upload to backend
      const res = await fetch('/api/productos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productoId: producto.id,
          imageBase64: base64Data,
          codigo: producto.codigo 
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al subir imagen');
      }

      const { imagen_url } = await res.json();
      
      // Update local state and parent
      skipNextSync.current = true;
      setCurrentImageUrl(imagen_url);
      onUpdated({ ...producto, imagen_url });
      toast.success('Imagen actualizada con éxito');
      setPreviewUrl(null);
      setSelectedFile(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePrices = async () => {
    if (!producto) return;
    setIsSaving(true);
    
    try {
      const res = await fetch(`/api/productos/\${producto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prcventa: parseFloat(prcVenta),
          prcminimo: parseFloat(prcMinimo),
        }),
      });

      if (!res.ok) throw new Error('Error guardando precios');
      
      const { data } = await res.json();
      onUpdated(data);
      toast.success('Precios actualizados');
      setIsEditing(false);
    } catch (error) {
       toast.error('No se pudo actualizar el precio');
    } finally {
       setIsSaving(false);
    }
  };

  const handleCategoriaChange = async (valor: string) => {
    if (!producto) return;
    setCategoria(valor);
    try {
      const res = await fetch(`/api/productos/${producto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: valor || null }),
      });
      if (!res.ok) throw new Error('Error actualizando categoría');
      const { data } = await res.json();
      onUpdated(data);
      toast.success('Categoría actualizada');
    } catch {
      toast.error('No se pudo actualizar la categoría');
    }
  };

  const handleMarkAsViewed = async () => {
    if (!producto) return;
    try {
      const res = await fetch(`/api/productos/\${producto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_nuevo: false }),
      });
      if (res.ok) {
        const { data } = await res.json();
        onUpdated(data);
        toast.success('Marcado como visto');
      }
    } catch (e) {
      toast.error('Error al actualizar');
    }
  };

  if (!producto) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenStatus}>
      <SheetContent className="w-screen h-screen sm:w-[500px] sm:h-full max-w-full overflow-y-auto flex flex-col p-0">
        <div className="p-5 flex flex-col h-full overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left font-mono text-zinc-500 flex items-center gap-2">
              <span>{producto.codigo}</span>
              {empresa && (
                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${empresa.color}`}>
                  {empresa.label}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription className="text-left text-base text-foreground font-medium">
              {producto.detalle}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
          {/* Main Image */}
          <div className="w-full aspect-square relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 border">
            <ImageWithFallback 
              src={currentImageUrl || producto.imagen_url} 
              codigo={producto.codigo} 
              empresaSlug={empresaSlug}
              fill
              className="object-contain"
            />
            {(currentImageUrl || producto.imagen_url) && (
              <button
                onClick={() => shareImage(
                  currentImageUrl || producto.imagen_url || '',
                  `${producto.codigo}.jpg`,
                  `${producto.codigo} — ${producto.detalle || ''}`
                )}
                className="absolute top-2 right-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white dark:hover:bg-zinc-800 transition-colors z-10"
              >
                <Share2 className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              </button>
            )}
          </div>

          {/* Logistics Data */}
          <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Zofri</p>
              <p className="font-semibold text-lg">{producto.saldo} {producto.umed}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Packing</p>
              {producto.cantcaja > 1 ? (
                <>
                  <p className="font-medium text-sm">{producto.cantcaja} {producto.umed}/Caja</p>
                  <p className="text-xs text-zinc-400">{producto.pesocaja} kg · {producto.cubicaja} m³</p>
                </>
              ) : (
                <p className="text-sm text-zinc-400">—</p>
              )}
            </div>
          </div>

          {/* Pricing Table */}
          {!ocultarPrecios && (
          <div>
            <div className="flex items-center justify-between mb-2">
               <h3 className="font-semibold uppercase tracking-wider text-xs text-zinc-500">Precios (USD)</h3>
               {/* DISABLED_V2: Edit button
               {canEditPrices && !isEditing && (
                 <Button variant="link" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
               )}
               */}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-zinc-500">Costo</TableCell>
                    <TableCell className="text-right">{formatUSD(producto.costo)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-zinc-500">Mín. vendido</TableCell>
                    <TableCell className="text-right">
                      {kardexLoading ? <span className="animate-pulse">...</span> : kardex?.precio_minimo ? formatUSD(kardex.precio_minimo) : '—'}
                    </TableCell>
                  </TableRow>
                  {(!kardexLoading && kardex?.precio_medio_status === 'ok') && (
                    <TableRow>
                      <TableCell className="font-medium text-zinc-500">Precio medio</TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400 font-semibold">{formatUSD(kardex.precio_medio ?? 0)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="font-medium text-zinc-500">Máx. vendido</TableCell>
                    <TableCell className="text-right">
                      {kardexLoading ? <span className="animate-pulse">...</span> : kardex?.precio_maximo ? formatUSD(kardex.precio_maximo) : '—'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            {kardex && kardex.total_ventas > 0 && (
              <div className="text-xs text-zinc-400 space-y-0.5 mt-2">
                <div>{kardex.total_ventas} ventas registradas</div>
                {kardex.precio_medio_status === 'sin_variacion' && <div>Siempre se ha vendido al mismo precio</div>}
                {kardex.precio_medio_status === 'solo_dos' && <div>Solo se ha vendido a dos precios distintos</div>}
                {kardex.precio_medio_status === 'empate' && <div>No existe un precio medio único</div>}
                {kardex.clientes_excluidos > 0 && <div>{kardex.clientes_excluidos} {kardex.clientes_excluidos === 1 ? 'cliente excluido' : 'clientes excluidos'}</div>}
              </div>
            )}
            {isEditing && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="w-full" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button className="w-full" onClick={handleSavePrices} disabled={isSaving}>Guardar</Button>
              </div>
            )}
          </div>
          )}

          {/* Admin Tools */}
          {canEditPrices && (
             <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold uppercase tracking-wider text-xs text-zinc-500">Herramientas de Gestión</h3>
                
                {/* DISABLED_V2: Mark as viewed button
                {isAdmin && producto.es_nuevo && (
                  <Button variant="secondary" className="w-full" onClick={handleMarkAsViewed}>
                    Quitar etiqueta NUEVO
                  </Button>
                )}
                */}

                <div className="space-y-4">
                   <div 
                     className="p-6 border-2 border-dashed rounded-xl text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border-zinc-200 dark:border-zinc-800"
                     onClick={() => fileInputRef.current?.click()}
                   >
                     {previewUrl ? (
                         <div className="relative w-full aspect-square max-w-[120px] mx-auto overflow-hidden rounded-md border shadow-sm">
                            <img src={previewUrl} alt="Preview" className="object-cover w-full h-full" />
                         </div>
                     ) : (
                         <div className="text-zinc-500">
                           <p className="font-semibold text-sm">Click para subir imagen</p>
                           <p className="text-xs text-zinc-400 mt-1">NUEVA IMAGEN INDIVIDUAL</p>
                         </div>
                     )}
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       accept="image/jpeg,image/png,image/webp" 
                       onChange={handleFileChange} 
                       data-testid="upload-input"
                     />
                   </div>

                   {selectedFile && (
                     <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-500 hover:text-red-700"
                          onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                        >
                          Limpiar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 font-bold bg-blue-600 hover:bg-blue-700 h-9"
                          onClick={handleUpload}
                          disabled={isUploading}
                        >
                          {isUploading ? 'Subiendo...' : 'SUBIR IMAGEN'}
                        </Button>
                     </div>
                   )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500 uppercase tracking-wider">Categoría</Label>
                  <select
                    value={categoria}
                    onChange={e => handleCategoriaChange(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                  >
                    <option value="">Sin categoría</option>
                    {categoriasDisponibles.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
             </div>
          )}

          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
