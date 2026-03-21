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

interface ProductDrawerProps {
  producto: Producto | null;
  empresaSlug: string;
  session: UserSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updatedProduct: Producto) => void;
}

export function ProductDrawer({ producto, empresaSlug, session, open, onOpenChange, onUpdated }: ProductDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [prcVenta, setPrcVenta] = useState('');
  const [prcMinimo, setPrcMinimo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const skipNextSync = useRef(false);

  const canEditPrices = ['admin', 'supervisor'].includes(session.rol);
  const isAdmin = session.rol === 'admin';

  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    setCurrentImageUrl(producto?.imagen_url || null);
  }, [producto]);

  // Sync state when product opens
  const handleOpenStatus = (isOpen: boolean) => {
    if (isOpen && producto) {
      setPrcVenta(producto.prcventa.toString());
      setPrcMinimo(producto.prcminimo.toString());
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
            <SheetTitle className="text-left font-mono text-zinc-500">{producto.codigo}</SheetTitle>
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
          </div>

          {/* Logistics Data */}
          <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Saldo</p>
              <p className="font-semibold text-lg">{producto.saldo} {producto.umed}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Cajas</p>
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
                    <TableCell className="font-medium text-zinc-500">CIF</TableCell>
                    <TableCell className="text-right">${producto.cif ? Number(producto.cif).toFixed(4) : '0.0000'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-zinc-500">Costo</TableCell>
                    <TableCell className="text-right">{formatUSD(producto.costo)}</TableCell>
                  </TableRow>
                  
                  {isEditing ? (
                    <>
                      <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                        <TableCell className="font-medium"><Label>Venta</Label></TableCell>
                        <TableCell className="text-right p-2">
                           <Input type="number" step="0.01" value={prcVenta} onChange={e => setPrcVenta(e.target.value)} className="h-8 text-right" />
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                        <TableCell className="font-medium"><Label>Mínimo</Label></TableCell>
                        <TableCell className="text-right p-2">
                           <Input type="number" step="0.01" value={prcMinimo} onChange={e => setPrcMinimo(e.target.value)} className="h-8 text-right" />
                        </TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <>
                      <TableRow>
                        <TableCell className="font-bold text-zinc-900 dark:text-zinc-100">Venta</TableCell>
                        <TableCell className="text-right font-bold text-lg text-blue-600 dark:text-blue-400">{formatUSD(producto.prcventa)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-zinc-500">Mínimo</TableCell>
                        <TableCell className="text-right text-zinc-500">{formatUSD(producto.prcminimo)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            {isEditing && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="w-full" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button className="w-full" onClick={handleSavePrices} disabled={isSaving}>Guardar</Button>
              </div>
            )}
          </div>

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
             </div>
          )}

          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
