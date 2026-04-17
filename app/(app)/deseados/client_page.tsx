'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAlertas } from '@/contexts/AlertasContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { PlusCircle, CheckCircle, X, Trash2, Bell, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

type Tab = 'pendiente' | 'avisado' | 'descartado';

interface Deseado {
  id: number;
  cliente_winfac_id: string | null;
  cliente_deseado_id: number | null;
  codigo: string | null;
  descripcion: string;
  nota: string | null;
  estado: Tab;
  alerta_activa: boolean;
  created_at: string;
  avisado_por: string | null;
  comentario_aviso: string | null;
  avisado_at: string | null;
  imagen_url: string | null;
  imagen_public_id: string | null;
  cliente_nombre: string | null;
  cliente_deseado_nombre: string | null;
  cliente_deseado_whatsapp: string | null;
  cliente_deseado_ciudad: string | null;
  cliente_ciudad: string | null;
}

interface ClienteWinfac {
  kcodclie: string;
  nombress: string;
  ciudad?: string | null;
  celular?: string | null;
}

interface ProductoResult {
  id: number;
  codigo: string;
  detalle: string;
}

interface ClienteAgrupado {
  clienteKey: string;
  clienteNombre: string;
  ciudad: string | null;
  whatsapp: string | null;
  items: Deseado[];
  tieneAlerta: boolean;
}

export function DeseadosClient({ session }: { session: any }) {
  const isAdmin = session?.rol === 'admin';
  const { refreshAlertas } = useAlertas();
  const searchParams = useSearchParams();
  const modoChina = searchParams.get('modo') === 'china';

  // --- Lista principal ---
  const [tab, setTab] = useState<Tab>('pendiente');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deseados, setDeseados] = useState<Deseado[]>([]);
  const [loading, setLoading] = useState(false);

  const clientesAgrupados = useMemo(() => {
    const map = new Map<string, ClienteAgrupado>();
    for (const d of deseados) {
      const key = d.cliente_winfac_id
        ? `winfac-${d.cliente_winfac_id}`
        : `deseado-${d.cliente_deseado_id}`;
      const nombre = d.cliente_nombre || d.cliente_deseado_nombre || 'Cliente desconocido';
      const ciudad = d.cliente_ciudad || d.cliente_deseado_ciudad || null;
      const whatsapp = d.cliente_deseado_whatsapp || null;
      if (!map.has(key)) {
        map.set(key, { clienteKey: key, clienteNombre: nombre, ciudad, whatsapp, items: [], tieneAlerta: false });
      }
      const entry = map.get(key)!;
      entry.items.push(d);
      if (d.alerta_activa) entry.tieneAlerta = true;
    }
    return Array.from(map.values());
  }, [deseados]);

  // --- Modal aviso ---
  const [avisandoId, setAvisandoId] = useState<number | null>(null);
  const [comentarioAviso, setComentarioAviso] = useState('');

  // --- Modal ---
  const [modalOpen, setModalOpen] = useState(false);
  const [pasoModal, setPasoModal] = useState<'cliente' | 'producto'>('cliente');
  const [tipoCliente, setTipoCliente] = useState<'winfac' | 'nuevo'>('winfac');
  const [tipoProducto, setTipoProducto] = useState<'codigo' | 'libre'>('codigo');

  const [clienteWinfacSearch, setClienteWinfacSearch] = useState('');
  const [clienteWinfacResultados, setClienteWinfacResultados] = useState<ClienteWinfac[]>([]);
  const [clienteWinfacLoading, setClienteWinfacLoading] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<{
    id: string;
    nombre: string;
    tipo: 'winfac' | 'nuevo';
  } | null>(null);

  const [nuevoClienteForm, setNuevoClienteForm] = useState({
    nombre: '',
    pais: '',
    ciudad: '',
    whatsapp: '',
  });

  const [productoSearch, setProductoSearch] = useState('');
  const [productoResultados, setProductoResultados] = useState<ProductoResult[]>([]);
  const [productoLoading, setProductoLoading] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<{
    codigo: string;
    descripcion: string;
  } | null>(null);

  const [descripcionLibre, setDescripcionLibre] = useState('');
  const [notaItem, setNotaItem] = useState('');
  const [productosLista, setProductosLista] = useState<Array<{ codigo: string | null; descripcion: string; nota: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  // --- Debounce búsqueda principal ---
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // --- Fetch deseados ---
  useEffect(() => {
    async function fetchDeseados() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ estado: tab });
        if (debouncedSearch.trim().length >= 2) params.set('search', debouncedSearch.trim());
        if (modoChina) params.set('sinCodigo', 'true');
        const res = await fetch(`/api/deseados?${params.toString()}`);
        if (res.ok) {
          const { data } = await res.json();
          setDeseados(data || []);
        }
      } catch {
        toast.error('Error cargando deseados');
      } finally {
        setLoading(false);
      }
    }
    fetchDeseados();
  }, [tab, debouncedSearch, modoChina]);

  // --- Debounce búsqueda cliente WinFac ---
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

  // --- Debounce búsqueda producto ---
  useEffect(() => {
    if (productoSearch.trim().length < 2) {
      setProductoResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setProductoLoading(true);
      try {
        const res = await fetch(
          `/api/productos?search=${encodeURIComponent(productoSearch.trim())}`
        );
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

  // --- Reset modal ---
  const resetModal = () => {
    setPasoModal('cliente');
    setTipoCliente('winfac');
    setTipoProducto(modoChina ? 'libre' : 'codigo');
    setClienteWinfacSearch('');
    setClienteWinfacResultados([]);
    setClienteSeleccionado(null);
    setNuevoClienteForm({ nombre: '', pais: '', ciudad: '', whatsapp: '' });
    setProductoSearch('');
    setProductoResultados([]);
    setProductoSeleccionado(null);
    setDescripcionLibre('');
    setNotaItem('');
    setProductosLista([]);
  };

  const handleOpenModal = () => {
    resetModal();
    setModalOpen(true);
  };

  // --- Validación paso 1 ---
  const paso1Valido =
    tipoCliente === 'winfac'
      ? clienteSeleccionado !== null
      : nuevoClienteForm.nombre.trim().length > 0;

  // --- Validación paso 2 ---
  const paso2Valido = productosLista.length > 0;

  // --- Agregar ítem a la lista ---
  const handleAgregarProducto = () => {
    if (tipoProducto === 'codigo' && !productoSeleccionado) return;
    if (tipoProducto === 'libre' && !descripcionLibre.trim()) return;

    const nuevoItem = {
      codigo: tipoProducto === 'codigo' ? productoSeleccionado!.codigo : null,
      descripcion: tipoProducto === 'codigo'
        ? productoSeleccionado!.descripcion
        : descripcionLibre.trim(),
      nota: notaItem.trim(),
    };

    setProductosLista(prev => [...prev, nuevoItem]);
    setProductoSeleccionado(null);
    setProductoSearch('');
    setProductoResultados([]);
    setDescripcionLibre('');
    setNotaItem('');
  };

  // --- Crear deseo ---
  const handleCrearDeseo = async () => {
    if (!paso2Valido) return;
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
        cliente_winfac_id = clienteSeleccionado?.id;
      }

      const resultados = await Promise.all(
        productosLista.map(item =>
          fetch('/api/deseados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cliente_winfac_id,
              cliente_deseado_id,
              codigo: item.codigo ?? undefined,
              descripcion: item.descripcion,
              nota: item.nota || undefined,
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
      setModalOpen(false);
      resetModal();
      // Refetch
      const params = new URLSearchParams({ estado: tab });
      if (debouncedSearch.trim().length >= 2) params.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/deseados?${params.toString()}`);
      if (res.ok) {
        const { data } = await res.json();
        setDeseados(data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  // --- Acciones ---
  const handleAvisar = async (id: number, comentario: string) => {
    setDeseados(prev =>
      prev.map(d => (d.id === id ? { ...d, estado: 'avisado', alerta_activa: false } : d))
    );
    try {
      await fetch(`/api/deseados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'avisado', comentario_aviso: comentario || null }),
      });
      toast.success('Marcado como avisado');
      setAvisandoId(null);
      setComentarioAviso('');
      setDeseados(prev => prev.filter(d => d.id !== id));
      await refreshAlertas();
    } catch {
      toast.error('Error al avisar');
    }
  };

  const handleDescartar = async (id: number) => {
    setDeseados(prev =>
      prev.map(d => (d.id === id ? { ...d, estado: 'descartado' } : d))
    );
    try {
      await fetch(`/api/deseados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'descartado' }),
      });
      toast.success('Descartado');
      setDeseados(prev => prev.filter(d => d.id !== id));
    } catch {
      toast.error('Error al descartar');
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await fetch(`/api/deseados/${id}`, { method: 'DELETE' });
      toast.success('Eliminado');
      setDeseados(prev => prev.filter(d => d.id !== id));
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleSubirImagen = (deseadoId: number, file: File) => {
    setUploadingId(deseadoId);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch('/api/deseados/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deseadoId, imageBase64: base64 }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Error subiendo imagen');
        const { data } = await res.json();
        setDeseados(prev => prev.map(d => d.id === deseadoId ? { ...d, imagen_url: data.imagen_url, imagen_public_id: data.imagen_public_id } : d));
        toast.success('Imagen subida');
      } catch (err: any) {
        toast.error(err.message || 'Error subiendo imagen');
      } finally {
        setUploadingId(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'avisado', label: 'Avisados' },
    { key: 'descartado', label: 'Descartados' },
  ];

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{modoChina ? 'Pedir a China' : 'Productos Deseados'}</h1>
        <Button onClick={handleOpenModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md w-fit">
          <PlusCircle className="w-5 h-5 mr-2" />
          Nuevo deseo
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Input
          placeholder="Buscar por descripción, código o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : deseados.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          No hay productos deseados en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
          {clientesAgrupados.map(cliente => (
            <div
              key={cliente.clienteKey}
              className="bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-sm flex flex-col"
            >
              {/* Header del cliente */}
              <div className="p-4 border-b border-border flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-base leading-tight">{cliente.clienteNombre}</p>
                    {cliente.tieneAlerta && (
                      <span className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        <Bell className="w-3 h-3" />
                        ¡Llegó!
                      </span>
                    )}
                  </div>
                  {(cliente.ciudad || cliente.whatsapp) && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {[cliente.ciudad, cliente.whatsapp].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0">
                  {cliente.items.length} {cliente.items.length === 1 ? 'producto' : 'productos'}
                </span>
              </div>

              {/* Lista de productos */}
              <div className="flex flex-col divide-y divide-border">
                {cliente.items.map(d => (
                  <div key={d.id} className="p-3 flex flex-col gap-2">
                    {/* Producto info */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {d.alerta_activa && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            ¡Llegó!
                          </span>
                        )}
                        {d.codigo ? (
                          <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                            {d.codigo}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Pedir a China
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-snug">{d.descripcion}</p>
                      {d.nota && (
                        <p className="text-xs text-zinc-400 italic">{d.nota}</p>
                      )}
                      {d.imagen_url && (
                        <img
                          src={d.imagen_url}
                          alt={d.descripcion}
                          className="w-full max-h-40 object-contain rounded-md border border-border mt-1"
                        />
                      )}
                      {!d.codigo && !d.imagen_url && (
                        <label className={`inline-flex items-center gap-1 cursor-pointer text-xs px-2 py-1 rounded border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-blue-500 hover:border-blue-400 transition-colors mt-1 ${uploadingId === d.id ? 'opacity-50 pointer-events-none' : ''}`}>
                          <Camera className="w-3.5 h-3.5" />
                          {uploadingId === d.id ? 'Subiendo...' : 'Agregar foto'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleSubirImagen(d.id, e.target.files[0]); }}
                          />
                        </label>
                      )}
                      <p className="text-xs text-zinc-400">
                        {format(new Date(d.created_at), 'dd MMM yyyy', { locale: es })}
                      </p>
                      {/* Info aviso solo en tab avisados */}
                      {tab === 'avisado' && (d.avisado_por || d.avisado_at || d.comentario_aviso) && (
                        <div className="flex flex-col gap-0.5 mt-1">
                          {d.avisado_por && (
                            <p className="text-xs text-zinc-400">Avisado por {d.avisado_por}</p>
                          )}
                          {d.avisado_at && (
                            <p className="text-xs text-zinc-400">
                              el {format(new Date(d.avisado_at), 'dd MMM yyyy', { locale: es })}
                            </p>
                          )}
                          {d.comentario_aviso && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded p-2 mt-1">
                              {d.comentario_aviso}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Acciones por ítem */}
                    <div className="flex gap-2">
                      {tab === 'pendiente' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`flex-1 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20 ${d.alerta_activa ? 'ring-2 ring-emerald-400' : ''}`}
                            onClick={() => { setAvisandoId(d.id); setComentarioAviso(''); }}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Avisar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                            onClick={() => handleDescartar(d.id)}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Descartar
                          </Button>
                        </>
                      )}
                      {tab === 'avisado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                          onClick={() => handleDescartar(d.id)}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Descartar
                        </Button>
                      )}
                      {tab === 'descartado' && isAdmin && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 text-xs"
                          onClick={() => handleEliminar(d.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmación aviso */}
      <Dialog
        open={avisandoId !== null}
        onOpenChange={open => { if (!open) { setAvisandoId(null); setComentarioAviso(''); } }}
      >
        <DialogContent className="sm:max-w-md p-5">
          <DialogHeader>
            <DialogTitle>Confirmar aviso al cliente</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <textarea
              value={comentarioAviso}
              onChange={e => setComentarioAviso(e.target.value)}
              placeholder="Comentario u observación (opcional)..."
              rows={3}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAvisandoId(null); setComentarioAviso(''); }}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { if (avisandoId !== null) handleAvisar(avisandoId, comentarioAviso); }}
            >
              Confirmar aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal nuevo deseo */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) { setModalOpen(false); resetModal(); } }}>
        <DialogContent className="w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:mx-4 overflow-y-auto p-5 rounded-none sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {pasoModal === 'cliente' ? 'Paso 1 — Cliente' : 'Paso 2 — Producto'}
            </DialogTitle>
          </DialogHeader>

          {pasoModal === 'cliente' ? (
            <div className="space-y-4 py-4">
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
                            setClienteSeleccionado({ id: c.kcodclie, nombre: c.nombress, tipo: 'winfac' });
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
            </div>
          ) : (
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
          )}

          <DialogFooter className="gap-2">
            {pasoModal === 'cliente' ? (
              <>
                <Button variant="outline" onClick={() => { setModalOpen(false); resetModal(); }}>
                  Cancelar
                </Button>
                <Button onClick={() => setPasoModal('producto')} disabled={!paso1Valido}>
                  Siguiente →
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setPasoModal('cliente')}>
                  ← Volver
                </Button>
                <Button onClick={handleCrearDeseo} disabled={!paso2Valido || saving}>
                  {saving ? 'Guardando...' : productosLista.length > 1 ? 'Guardar todo' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
