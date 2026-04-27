'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PasoProductoDeseadoProps {
  clienteWinfacId?: string;
  clienteDeseadoId?: number;
  onGuardado: () => void;
  onCancelar: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}

interface ProductoResult {
  id: number;
  codigo: string;
  detalle: string;
}

export function PasoProductoDeseado({
  clienteWinfacId,
  clienteDeseadoId,
  onGuardado,
  onCancelar,
  saving,
  setSaving,
}: PasoProductoDeseadoProps) {
  const [tipoProducto, setTipoProducto] = useState<'codigo' | 'libre'>('codigo');
  const [productoSearch, setProductoSearch] = useState('');
  const [productoResultados, setProductoResultados] = useState<ProductoResult[]>([]);
  const [productoLoading, setProductoLoading] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<{ codigo: string; descripcion: string } | null>(null);
  const [descripcionLibre, setDescripcionLibre] = useState('');
  const [notaItem, setNotaItem] = useState('');
  const [productosLista, setProductosLista] = useState<Array<{ codigo: string | null; descripcion: string; nota: string; esChina: boolean }>>([]);

  useEffect(() => {
    if (productoSearch.trim().length < 2) {
      setProductoResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setProductoLoading(true);
      try {
        const res = await fetch(`/api/productos?search=${encodeURIComponent(productoSearch.trim())}`);
        if (res.ok) {
          const { data } = await res.json();
          setProductoResultados(data || []);
        }
      } catch {
        // silencioso
      } finally {
        setProductoLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [productoSearch]);

  const handleAgregarProducto = () => {
    if (tipoProducto === 'codigo' && !productoSeleccionado) return;
    if (tipoProducto === 'libre' && !descripcionLibre.trim()) return;

    const nuevoItem = {
      codigo: tipoProducto === 'codigo' ? productoSeleccionado!.codigo : null,
      descripcion: tipoProducto === 'codigo' ? productoSeleccionado!.descripcion : descripcionLibre.trim(),
      nota: notaItem.trim(),
      esChina: tipoProducto === 'libre',
    };

    setProductosLista(prev => [...prev, nuevoItem]);
    setProductoSeleccionado(null);
    setProductoSearch('');
    setProductoResultados([]);
    setDescripcionLibre('');
    setNotaItem('');
  };

  const paso2Valido = productosLista.length > 0;

  const handleGuardar = async () => {
    if (!paso2Valido) return;
    if (!clienteWinfacId && !clienteDeseadoId) {
      toast.error('Selecciona un cliente antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      const resultados = await Promise.all(
        productosLista.map(item =>
          fetch('/api/deseados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cliente_winfac_id: clienteWinfacId,
              cliente_deseado_id: clienteDeseadoId,
              codigo: item.codigo ?? undefined,
              descripcion: item.descripcion,
              nota: item.nota || undefined,
              es_china: item.esChina,
            }),
          })
        )
      );

      const fallido = resultados.find(r => !r.ok);
      if (fallido) {
        const err = await fallido.json();
        throw new Error(err.error || 'Error guardando deseo');
      }

      toast.success(productosLista.length > 1 ? `${productosLista.length} deseos registrados` : 'Deseo registrado');
      onGuardado();
    } catch (err: any) {
      toast.error(err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4 py-4">
        {/* Toggle tipo producto */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tipoProducto === 'codigo' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            onClick={() => { setTipoProducto('codigo'); setProductoSeleccionado(null); }}
          >
            Tiene código
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tipoProducto === 'libre' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            onClick={() => { setTipoProducto('libre'); setProductoSeleccionado(null); }}
          >
            Pedir a China
          </button>
        </div>

        {tipoProducto === 'codigo' ? (
          <div className="space-y-2">
            <Input
              placeholder="Buscar por código o descripción..."
              value={productoSearch}
              onChange={e => { setProductoSearch(e.target.value); setProductoSeleccionado(null); }}
            />
            {productoLoading && (
              <p className="text-xs text-zinc-400 animate-pulse">Buscando...</p>
            )}
            {productoResultados.length > 0 && !productoSeleccionado && (
              <ul className="border rounded-lg overflow-hidden divide-y max-h-48 overflow-y-auto">
                {productoResultados.map(p => (
                  <li
                    key={p.id}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setProductoSeleccionado({ codigo: p.codigo, descripcion: p.detalle });
                      setProductoResultados([]);
                    }}
                  >
                    <p className="font-mono text-xs text-zinc-500">{p.codigo}</p>
                    <p className="font-medium leading-tight">{p.detalle}</p>
                  </li>
                ))}
              </ul>
            )}
            {productoSeleccionado && (
              <div className="flex items-start justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                <div>
                  <p className="font-mono text-xs text-blue-500">{productoSeleccionado.codigo}</p>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 leading-tight">{productoSeleccionado.descripcion}</p>
                </div>
                <button
                  className="text-blue-400 hover:text-blue-600 flex-shrink-0 ml-2"
                  onClick={() => { setProductoSeleccionado(null); setProductoSearch(''); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Descripción *</label>
            <textarea
              value={descripcionLibre}
              onChange={e => setDescripcionLibre(e.target.value)}
              placeholder="Describir el producto que busca el cliente..."
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 resize-none"
            />
          </div>
        )}

        {/* Nota del ítem */}
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Nota del ítem (opcional)</label>
          <Input
            value={notaItem}
            onChange={e => setNotaItem(e.target.value)}
            placeholder="Alguna observación..."
            className="mt-1"
          />
        </div>

        {/* Botón Agregar */}
        {(() => {
          const puedeAgregar =
            (tipoProducto === 'codigo' && productoSeleccionado !== null) ||
            (tipoProducto === 'libre' && descripcionLibre.trim().length > 0);
          return (
            <Button
              variant={puedeAgregar ? 'default' : 'outline'}
              className={`w-full transition-all ${puedeAgregar ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : ''}`}
              onClick={handleAgregarProducto}
              disabled={!puedeAgregar}
            >
              Agregar +
            </Button>
          );
        })()}

        {/* Lista de productos agregados */}
        {productosLista.length > 0 && (
          <div className="border rounded-lg divide-y mt-2">
            {productosLista.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 gap-2">
                <div className="flex-1 min-w-0">
                  {item.codigo ? (
                    <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded mr-1">
                      {item.codigo}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 mr-1">
                      China
                    </span>
                  )}
                  <span className="text-sm truncate">{item.descripcion}</span>
                  {item.nota && (
                    <p className="text-xs text-zinc-400 italic mt-0.5">{item.nota}</p>
                  )}
                </div>
                <button
                  onClick={() => setProductosLista(prev => prev.filter((_, i) => i !== idx))}
                  className="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancelar}>
          ← Volver
        </Button>
        <Button onClick={handleGuardar} disabled={!paso2Valido || saving}>
          {saving ? 'Guardando...' : productosLista.length > 1 ? 'Guardar todo' : 'Guardar'}
        </Button>
      </div>
    </>
  );
}
