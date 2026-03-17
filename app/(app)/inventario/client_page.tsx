'use client';

import { useState, useEffect } from 'react';
import { UserSession } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Save, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Ubicacion {
  id: number;
  codigo: string;
  ubicacion: string;
  detalle: string;
  producto_detalle: string;
  saldo: number;
  saldocajas: number;
  umed: string;
  fisico: number | null;
  diferencia: number | null;
  observaciones: string | null;
}

export function InventarioClient({ activeEmpresaId }: { activeEmpresaId: number }) {
  const [data, setData] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Unsaved edits
  const [edits, setEdits] = useState<Record<number, { fisico?: string, observaciones?: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        empresa: activeEmpresaId.toString(),
        page: page.toString(),
        limit: '50',
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      
      const res = await fetch(`/api/inventario?${queryParams.toString()}`);
      if (res.ok) {
        const { data: items, pagination } = await res.json();
        setData(items || []);
        setTotalPages(pagination.totalPages);
        setTotalItems(pagination.total);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData() }, [activeEmpresaId, debouncedSearch, page]);

  const handleEditChange = (id: number, field: 'fisico' | 'observaciones', value: string) => {
    setEdits(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSaveBulk = async () => {
    const changes = Object.keys(edits).map(idStr => {
      const id = parseInt(idStr, 10);
      return { id, ...edits[id] };
    });

    if (changes.length === 0) return toast.info('No hay cambios pendientes');

    setIsSaving(true);
    try {
      const res = await fetch('/api/inventario/bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeEmpresaId,
          updates: changes,
        }),
      });

      if (!res.ok) throw new Error('Error en el guardado masivo');
      
      const resData = await res.json();
      toast.success(resData.message || 'Actualización exitosa');
      setEdits({});
      fetchData(); // reload freshness
    } catch (error) {
      toast.error('Ocurrió un error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Ingreso de Inventario</h1>
          <p className="text-zinc-500 mt-1">Conteo Físico por Ubicación</p>
        </div>
        
        <Button 
          size="lg" 
          onClick={handleSaveBulk} 
          disabled={!hasEdits || isSaving}
          className={`font-semibold transition-all ${hasEdits ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg animate-pulse' : ''}`}
        >
          <Save className="w-5 h-5 mr-2" />
          {isSaving ? 'Guardando...' : `Guardar Cambios (${Object.keys(edits).length})`}
        </Button>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 border rounded-xl shadow-sm">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Buscar ubicación o producto..." 
            className="pl-9 bg-zinc-50 dark:bg-zinc-950"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4 text-sm font-medium">
          <span className="text-zinc-500">Total: {totalItems} registros</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="w-8 h-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
               <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="w-16 text-center tabular-nums">Pg {page} / {totalPages || 1}</span>
            <Button variant="outline" size="icon" className="w-8 h-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
               <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-zinc-50 dark:bg-zinc-900 border-b">
              <TableRow>
                <TableHead className="w-32 uppercase tracking-wide text-xs">Ubicación</TableHead>
                <TableHead className="w-32 uppercase tracking-wide text-xs">Código</TableHead>
                <TableHead className="uppercase tracking-wide text-xs">Descripción</TableHead>
                <TableHead className="w-24 text-right uppercase tracking-wide text-xs">Sistema</TableHead>
                <TableHead className="w-32 text-center uppercase tracking-wide text-xs bg-blue-50/50 dark:bg-blue-900/10">Físico</TableHead>
                <TableHead className="w-24 text-center uppercase tracking-wide text-xs">Dif</TableHead>
                <TableHead className="w-48 uppercase tracking-wide text-xs">Obs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-zinc-500">Cargando...</TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-zinc-500">No hay ubicaciones</TableCell>
                </TableRow>
              ) : (
                data.map((row) => {
                  const localFisicoRaw = edits[row.id]?.fisico;
                  
                  const isEdited = edits[row.id] !== undefined;
                  const currentFisicoStr = isEdited && localFisicoRaw !== undefined ? localFisicoRaw : (row.fisico !== null ? row.fisico.toString() : '');
                  const currentObs = isEdited && edits[row.id].observaciones !== undefined ? edits[row.id].observaciones : (row.observaciones || '');
                  
                  // Compute difference
                  let computedDiff: number | null = null;
                  if (currentFisicoStr !== '' && !isNaN(parseFloat(currentFisicoStr))) {
                     computedDiff = parseFloat(currentFisicoStr) - row.saldo;
                  } else if (row.fisico !== null) {
                     computedDiff = row.fisico - row.saldo;
                  }

                  let diffColor = '';
                  if (computedDiff !== null) {
                    diffColor = computedDiff === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700 font-bold';
                  }

                  return (
                    <TableRow key={row.id} className={isEdited ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/50' : ''}>
                      <TableCell className="font-bold whitespace-nowrap text-blue-700 dark:text-blue-400">{row.ubicacion || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.codigo}</TableCell>
                      <TableCell className="text-xs text-zinc-600 line-clamp-2 max-w-[200px]" title={row.producto_detalle || row.detalle}>
                         {row.producto_detalle || row.detalle}
                      </TableCell>
                      <TableCell className="text-right font-medium">{row.saldo}</TableCell>
                      
                      <TableCell className="p-1 bg-blue-50/20 dark:bg-blue-900/5">
                        <Input 
                          type="number" 
                          className={`h-9 font-bold text-center ${isEdited ? 'border-amber-400 focus-visible:ring-amber-500' : ''}`} 
                          value={currentFisicoStr}
                          onChange={(e) => handleEditChange(row.id, 'fisico', e.target.value)}
                        />
                      </TableCell>
                      
                      <TableCell className="text-center">
                        {computedDiff !== null && (
                          <Badge variant="outline" className={`w-full justify-center ${diffColor}`}>
                            {computedDiff > 0 ? '+' : ''}{computedDiff}
                          </Badge>
                        )}
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <Input 
                          type="text" 
                          placeholder="Notas..."
                          className={`h-9 text-xs ${isEdited ? 'border-amber-400 focus-visible:ring-amber-500' : ''}`}
                          value={currentObs}
                          onChange={(e) => handleEditChange(row.id, 'observaciones', e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
