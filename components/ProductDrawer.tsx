'use client';

import { useState } from 'react';
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

  const canEditPrices = ['admin', 'supervisor'].includes(session.rol);
  const isAdmin = session.rol === 'admin';

  // Sync state when product opens
  const handleOpenStatus = (isOpen: boolean) => {
    if (isOpen && producto) {
      setPrcVenta(producto.prcventa.toString());
      setPrcMinimo(producto.prcminimo.toString());
      setIsEditing(false);
    }
    onOpenChange(isOpen);
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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto pb-safe">
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
              src={producto.imagen_url} 
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
                <p className="font-medium text-sm">{producto.cantcaja} u/cj</p>
                <p className="text-xs text-zinc-400">{producto.pesocaja} kg · {producto.cubicaja} m³</p>
             </div>
             <div className="col-span-2">
                <p className="text-xs text-zinc-500 mb-1">Nro Ingreso</p>
                <p className="font-mono text-sm">{producto.nroingreso || 'N/A'}</p>
             </div>
          </div>

          {/* Pricing Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
               <h3 className="font-semibold uppercase tracking-wider text-xs text-zinc-500">Precios (USD)</h3>
               {canEditPrices && !isEditing && (
                 <Button variant="link" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
               )}
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
          {isAdmin && (
             <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold uppercase tracking-wider text-xs text-zinc-500">Herramientas Admin</h3>
                
                {producto.es_nuevo && (
                  <Button variant="secondary" className="w-full" onClick={handleMarkAsViewed}>
                    Quitar etiqueta NUEVO
                  </Button>
                )}

                {/* File picker for manual image upload would go here. We will build an ImageUploader widget later. */}
                <div className="p-4 border border-dashed rounded-lg text-center text-sm text-zinc-500">
                   Subir imagen individual (Pendiente para posterior)
                </div>
             </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
