'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasoProductoDeseado } from '@/components/PasoProductoDeseado';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AgregarADeseadosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codigo: string;
  descripcion: string;
  esChina?: boolean;
  clientePreseleccionado?: { id: string; nombre: string };
}

interface ClienteWinfac {
  kcodclie: string;
  nombress: string;
  ciudad?: string | null;
}

export function AgregarADeseadosModal({
  open,
  onOpenChange,
  codigo,
  descripcion,
  esChina,
  clientePreseleccionado,
}: AgregarADeseadosModalProps) {
  const [tipoDestino, setTipoDestino] = useState<'deseados' | 'china'>(esChina ? 'china' : 'deseados');
  const [tipoCliente, setTipoCliente] = useState<'winfac' | 'nuevo'>('winfac');
  const [clienteWinfacSearch, setClienteWinfacSearch] = useState('');
  const [clienteWinfacResultados, setClienteWinfacResultados] = useState<ClienteWinfac[]>([]);
  const [clienteWinfacLoading, setClienteWinfacLoading] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<{ id: string; nombre: string } | null>(null);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({ nombre: '', pais: '', ciudad: '', whatsapp: '' });
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTipoDestino(esChina ? 'china' : 'deseados');
      setTipoCliente('winfac');
      setClienteWinfacSearch('');
      setClienteWinfacResultados([]);
      setClienteSeleccionado(clientePreseleccionado ?? null);
      setNuevoClienteForm({ nombre: '', pais: '', ciudad: '', whatsapp: '' });
      setNota('');
    }
  }, [open, esChina, clientePreseleccionado]);

  useEffect(() => {
    if (clienteWinfacSearch.trim().length < 2) {
      setClienteWinfacResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setClienteWinfacLoading(true);
      try {
        const res = await fetch(
          `/api/ventas/clientes?q=${encodeURIComponent(clienteWinfacSearch.trim())}&empresaSlug=vida`
        );
        if (res.ok) {
          const { data } = await res.json();
          setClienteWinfacResultados(data || []);
        }
      } catch {
        // silencioso
      } finally {
        setClienteWinfacLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [clienteWinfacSearch]);

  const paso1Valido =
    tipoCliente === 'winfac'
      ? clienteSeleccionado !== null
      : nuevoClienteForm.nombre.trim().length > 0;

  const clienteWinfacIdPasoProducto =
    tipoCliente === 'winfac'
      ? (clientePreseleccionado?.id ?? clienteSeleccionado?.id)
      : undefined;
  const clienteDeseadoIdRaw = clientePreseleccionado?.id ?? clienteSeleccionado?.id;
  const clienteDeseadoIdPasoProducto =
    tipoCliente === 'nuevo' && clienteDeseadoIdRaw
      ? Number(clienteDeseadoIdRaw)
      : undefined;

  const handleGuardar = async () => {
    setSaving(true);
    try {
      let cliente_deseado_id: number | undefined;
      let cliente_winfac_id: string | undefined;

      if (tipoCliente === 'nuevo') {
        const resCliente = await fetch('/api/clientes-deseados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nuevoClienteForm.nombre.trim(),
            pais: nuevoClienteForm.pais.trim() || undefined,
            ciudad: nuevoClienteForm.ciudad.trim() || undefined,
            whatsapp: nuevoClienteForm.whatsapp.trim() || undefined,
          }),
        });
        if (!resCliente.ok) {
          const err = await resCliente.json();
          throw new Error(err.error || 'Error creando cliente');
        }
        const { data: clienteCreado } = await resCliente.json();
        cliente_deseado_id = clienteCreado.id;
      } else {
        cliente_winfac_id = clienteSeleccionado!.id;
      }

      const res = await fetch('/api/deseados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_winfac_id,
          cliente_deseado_id,
          codigo,
          descripcion,
          nota: nota.trim() || undefined,
          es_china: tipoDestino === 'china',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al agregar');
      }

      toast.success(tipoDestino === 'china' ? 'Agregado a Pedir a China' : 'Agregado a Deseados');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al agregar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-5">
        <DialogHeader>
          <DialogTitle>Agregar a Deseados</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {codigo !== '' && (
            <>
              {/* Toggle destino */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    tipoDestino === 'deseados' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={() => setTipoDestino('deseados')}
                >
                  ♡ Deseados
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    tipoDestino === 'china' ? 'bg-amber-500 text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={() => setTipoDestino('china')}
                >
                  Pedir a China
                </button>
              </div>
            </>
          )}

          {/* Producto */}
          {codigo !== '' && (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <span className="font-mono text-xs text-zinc-500">{codigo}</span>
              <span className="text-sm font-medium leading-snug">{descripcion}</span>
            </div>
          )}

          {/* Selección de cliente */}
          {clientePreseleccionado ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg px-3 py-2 border">
              <p className="text-xs text-zinc-400 mb-0.5">Cliente</p>
              <p className="text-sm font-semibold">{clientePreseleccionado.nombre}</p>
            </div>
          ) : (
          <>
          {/* Toggle tipo cliente */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tipoCliente === 'winfac' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              onClick={() => { setTipoCliente('winfac'); setClienteSeleccionado(null); }}
            >
              Cliente WinFac
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tipoCliente === 'nuevo' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              onClick={() => { setTipoCliente('nuevo'); setClienteSeleccionado(null); }}
            >
              Cliente nuevo
            </button>
          </div>

          {tipoCliente === 'winfac' ? (
            <div className="space-y-2">
              <Input
                placeholder="Buscar cliente por nombre..."
                value={clienteWinfacSearch}
                onChange={e => { setClienteWinfacSearch(e.target.value); setClienteSeleccionado(null); }}
              />
              {clienteWinfacLoading && (
                <p className="text-xs text-zinc-400 animate-pulse">Buscando...</p>
              )}
              {clienteWinfacResultados.length > 0 && !clienteSeleccionado && (
                <ul className="border rounded-lg overflow-hidden divide-y max-h-48 overflow-y-auto">
                  {clienteWinfacResultados.map(c => (
                    <li
                      key={c.kcodclie}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setClienteSeleccionado({ id: c.kcodclie, nombre: c.nombress });
                        setClienteWinfacResultados([]);
                      }}
                    >
                      <p className="font-medium">{c.nombress}</p>
                      {c.ciudad && <p className="text-xs text-zinc-400">{c.ciudad}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {clienteSeleccionado && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{clienteSeleccionado.nombre}</p>
                    <p className="text-xs text-blue-500">{clienteSeleccionado.id}</p>
                  </div>
                  <button
                    className="text-blue-400 hover:text-blue-600"
                    onClick={() => { setClienteSeleccionado(null); setClienteWinfacSearch(''); }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Nombre *</label>
                <Input
                  value={nuevoClienteForm.nombre}
                  onChange={e => setNuevoClienteForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">País</label>
                  <Input
                    value={nuevoClienteForm.pais}
                    onChange={e => setNuevoClienteForm(f => ({ ...f, pais: e.target.value }))}
                    placeholder="Ej: Chile"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ciudad</label>
                  <Input
                    value={nuevoClienteForm.ciudad}
                    onChange={e => setNuevoClienteForm(f => ({ ...f, ciudad: e.target.value }))}
                    placeholder="Ej: Iquique"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">WhatsApp</label>
                <Input
                  value={nuevoClienteForm.whatsapp}
                  onChange={e => setNuevoClienteForm(f => ({ ...f, whatsapp: e.target.value }))}
                  placeholder="+56912345678"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          </>
          )}

          {codigo === '' && (
            <PasoProductoDeseado
              clienteWinfacId={clienteWinfacIdPasoProducto}
              clienteDeseadoId={clienteDeseadoIdPasoProducto}
              saving={saving}
              setSaving={setSaving}
              onGuardado={() => onOpenChange(false)}
              onCancelar={() => onOpenChange(false)}
            />
          )}

          {/* Nota */}
          {codigo !== '' && (
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Nota (opcional)</label>
              <Input
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Alguna observación..."
                className="mt-1"
              />
            </div>
          )}
        </div>

        {codigo !== '' && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={!paso1Valido || saving}>
              {saving ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
