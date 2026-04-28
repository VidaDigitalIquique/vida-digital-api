'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAlertas } from '@/contexts/AlertasContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { PlusCircle, CheckCircle, X, Trash2, Bell, Camera, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AgregarADeseadosModal } from '@/components/AgregarADeseadosModal';
import { PasoProductoDeseado } from '@/components/PasoProductoDeseado';

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
  es_china: boolean;
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

interface ClienteAgrupado {
  clienteKey: string;
  clienteNombre: string;
  ciudad: string | null;
  whatsapp: string | null;
  items: Deseado[];
  tieneAlerta: boolean;
}

interface AlertaStock {
  id: number;
  codigo: string;
  empresa_id: number;
  detalle: string;
  saldo: number;
  cantcaja: number;
  total_clientes: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export function DeseadosClient({ session }: { session: any }) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dxkidwxjl';
  const isAdmin = session?.rol === 'admin';
  const { refreshAlertas } = useAlertas();
  const searchParams = useSearchParams();
  const modoChina = searchParams.get('modo') === 'china';
  const clienteDeseadoId = searchParams.get('cliente_deseado_id') ?? '';

  // --- Lista principal ---
  const [tab, setTab] = useState<Tab>('pendiente');
  const [pestanaChina, setPestanaChina] = useState<'vida_digital' | 'clientes'>('vida_digital');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deseados, setDeseados] = useState<Deseado[]>([]);
  const [loading, setLoading] = useState(false);

  const alertasFiltradas = useMemo(() => {
    if (!debouncedSearch.trim() || debouncedSearch.trim().length < 2) return alertasStock;
    const q = debouncedSearch.trim().toLowerCase();
    return alertasStock.filter(a =>
      a.codigo.toLowerCase().includes(q) ||
      a.detalle.toLowerCase().includes(q)
    );
  }, [alertasStock, debouncedSearch]);

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

  // --- Alertas stock bajo ---
  const [alertasStock, setAlertasStock] = useState<AlertaStock[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [deseadoModalExterno, setDeseadoModalExterno] = useState<{
    codigo: string;
    descripcion: string;
  } | null>(null);

  // --- Modal aviso ---
  const [avisandoId, setAvisandoId] = useState<number | null>(null);
  const [comentarioAviso, setComentarioAviso] = useState('');

  // --- Modal ---
  const [modalOpen, setModalOpen] = useState(false);
  const [pasoModal, setPasoModal] = useState<'cliente' | 'producto'>('cliente');
  const [tipoCliente, setTipoCliente] = useState<'winfac' | 'nuevo'>('winfac');

  const [clienteWinfacSearch, setClienteWinfacSearch] = useState('');
  const [clienteWinfacResultados, setClienteWinfacResultados] = useState<ClienteWinfac[]>([]);
  const [clienteWinfacLoading, setClienteWinfacLoading] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<{
    id: string;
    nombre: string;
    tipo: 'winfac' | 'nuevo';
  } | null>(null);
  const [busquedaClienteNuevo, setBusquedaClienteNuevo] = useState('');
  const [resultadosClienteNuevo, setResultadosClienteNuevo] = useState<any[]>([]);
  const [buscandoClienteNuevo, setBuscandoClienteNuevo] = useState(false);

  const [nuevoClienteForm, setNuevoClienteForm] = useState({
    nombre: '',
    pais: '',
    ciudad: '',
    whatsapp: '',
  });

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
        if (clienteDeseadoId) params.set('cliente_deseado_id', clienteDeseadoId);
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
  }, [tab, debouncedSearch, modoChina, clienteDeseadoId]);

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

  useEffect(() => {
    if (busquedaClienteNuevo.trim().length < 2) {
      setResultadosClienteNuevo([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscandoClienteNuevo(true);
      try {
        const res = await fetch(`/api/clientes-deseados?search=${encodeURIComponent(busquedaClienteNuevo.trim())}`);
        if (res.ok) {
          const { data } = await res.json();
          setResultadosClienteNuevo(data || []);
        }
      } catch {
        // silencioso
      } finally {
        setBuscandoClienteNuevo(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [busquedaClienteNuevo]);

  // --- Reset modal ---
  const resetModal = () => {
    setPasoModal('cliente');
    setTipoCliente('winfac');
    setClienteWinfacSearch('');
    setClienteWinfacResultados([]);
    setClienteSeleccionado(null);
    setNuevoClienteForm({ nombre: '', pais: '', ciudad: '', whatsapp: '' });
    setBusquedaClienteNuevo('');
    setResultadosClienteNuevo([]);
  };

  const handleOpenModal = () => {
    resetModal();
    setModalOpen(true);
  };

  // --- Validación paso 1 ---
  const paso1Valido =
    clienteSeleccionado !== null ||
    (tipoCliente === 'nuevo' && nuevoClienteForm.nombre.trim().length > 0);

  const refetchDeseados = async () => {
    const params = new URLSearchParams({ estado: tab });
    if (debouncedSearch.trim().length >= 2) params.set('search', debouncedSearch.trim());
    if (modoChina) params.set('sinCodigo', 'true');
    const res = await fetch(`/api/deseados?${params.toString()}`);
    if (res.ok) {
      const { data } = await res.json();
      setDeseados(data || []);
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

  // --- Fetch alertas stock bajo ---
  useEffect(() => {
    if (!modoChina) return;
    async function fetchAlertas() {
      setLoadingAlertas(true);
      try {
        const res = await fetch('/api/alertas-stock/lista');
        if (res.ok) {
          const { data } = await res.json();
          setAlertasStock(data || []);
        }
      } catch {}
      finally { setLoadingAlertas(false); }
    }
    fetchAlertas();
  }, [modoChina]);

  const handleIgnorarAlerta = async (id: number) => {
    setAlertasStock(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(`/api/alertas-stock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'ignorar' }),
      });
      toast.success('Alerta ignorada');
    } catch {
      toast.error('Error al ignorar alerta');
    }
  };

  const handleNoReponer = async (id: number, codigo: string) => {
    if (!confirm(`¿Marcar "${codigo}" como NO REPONER nunca más?`)) return;
    setAlertasStock(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(`/api/alertas-stock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'no_reponer' }),
      });
      toast.success('Producto marcado como no reponer');
    } catch {
      toast.error('Error');
    }
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
      {modoChina ? (
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setPestanaChina('vida_digital')}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              pestanaChina === 'vida_digital'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Vida Digital
          </button>
          <button
            onClick={() => setPestanaChina('clientes')}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              pestanaChina === 'clientes'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Clientes
          </button>
        </div>
      ) : (
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
      )}

      {modoChina && pestanaChina === 'clientes' && (
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
      )}

      {/* Buscador */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <Input
          placeholder="Buscar por descripción, código o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 pl-9"
        />
      </div>

      {/* Alertas stock bajo — solo modo China */}
      {modoChina && pestanaChina === 'vida_digital' && alertasStock.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
              ⚠️ Stock Bajo ({alertasFiltradas.length})
            </span>
            <span className="text-xs text-zinc-400">
              Productos con menos de 1 caja disponible
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alertasFiltradas.map(alerta => (
              <div
                key={alerta.id}
                className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex flex-col gap-2"
              >
                <div className="w-full h-24 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border relative">
                  <img
                    src={`https://res.cloudinary.com/${cloudName}/image/upload/productos/${alerta.codigo}.jpg`}
                    alt={alerta.codigo}
                    className="w-full h-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div>
                  <span className="font-mono text-[11px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {alerta.codigo}
                  </span>
                  <p className="text-sm font-medium leading-snug mt-1 line-clamp-2">{alerta.detalle}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-1">
                    Stock: {alerta.saldo} u ({Math.floor(alerta.saldo / alerta.cantcaja * 10) / 10} cajas)
                  </p>
                  {alerta.total_clientes > 0 && (
                    <p className="text-xs text-zinc-500 mt-1">
                      {alerta.total_clientes} clientes lo han comprado
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 mt-auto">
                  <Button
                    size="sm"
                    className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => setDeseadoModalExterno({ codigo: alerta.codigo, descripcion: alerta.detalle })}
                  >
                    Pedir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => handleIgnorarAlerta(alerta.id)}
                  >
                    Ignorar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-red-500 border-red-200 hover:bg-red-50 px-2"
                    onClick={() => handleNoReponer(alerta.id, alerta.codigo)}
                    title="No reponer nunca"
                  >
                    🚫
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      )}
      {!loading && deseados.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          No hay productos deseados en esta categoría.
        </div>
      )}
      {!loading && deseados.length > 0 && (
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
                        {d.codigo && (
                          <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                            {d.codigo}
                          </span>
                        )}
                        {d.es_china && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Pedir a China
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-snug">{d.descripcion}</p>
                      {d.nota && (
                        <p className="text-xs text-zinc-400 italic">{d.nota}</p>
                      )}
                      {/* Imagen del producto */}
                      {d.codigo && !d.es_china ? (
                        <div className="w-full h-32 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border mt-1 relative">
                          <img
                            src={`https://res.cloudinary.com/${cloudName}/image/upload/productos/${d.codigo}.jpg`}
                            alt={d.codigo}
                            className="w-full h-full object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : d.imagen_url ? (
                        <img
                          src={d.imagen_url}
                          alt={d.descripcion}
                          className="w-full max-h-40 object-contain rounded-md border border-border mt-1"
                        />
                      ) : d.es_china ? (
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
                      ) : null}
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
                  Cliente en Sistema
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
                <div className="space-y-4">
                  {/* Buscador de cliente existente */}
                  {!clienteSeleccionado && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                        ¿Ya existe este cliente?
                      </label>
                      <Input
                        placeholder="Buscar en clientes nuevos..."
                        value={busquedaClienteNuevo}
                        onChange={e => setBusquedaClienteNuevo(e.target.value)}
                      />
                      {buscandoClienteNuevo && (
                        <p className="text-xs text-zinc-400 animate-pulse">Buscando...</p>
                      )}
                      {resultadosClienteNuevo.length > 0 && (
                        <ul className="border rounded-lg overflow-hidden divide-y max-h-36 overflow-y-auto">
                          {resultadosClienteNuevo.map((c: any) => (
                            <li
                              key={c.id}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              onClick={() => {
                                setClienteSeleccionado({ id: String(c.id), nombre: c.nombre, tipo: 'nuevo' });
                                setBusquedaClienteNuevo('');
                                setResultadosClienteNuevo([]);
                              }}
                            >
                              <p className="font-medium">{c.nombre}</p>
                              {(c.ciudad || c.pais) && (
                                <p className="text-xs text-zinc-400">{[c.ciudad, c.pais].filter(Boolean).join(', ')}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {busquedaClienteNuevo.trim().length >= 2 && !buscandoClienteNuevo && resultadosClienteNuevo.length === 0 && (
                        <p className="text-xs text-zinc-400">No encontrado - completa el formulario para crear uno nuevo.</p>
                      )}
                    </div>
                  )}

                  {/* Si ya seleccionó un cliente existente, mostrarlo */}
                  {clienteSeleccionado && clienteSeleccionado.tipo === 'nuevo' && (
                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{clienteSeleccionado.nombre}</p>
                        <p className="text-xs text-emerald-500">Cliente existente</p>
                      </div>
                      <button
                        className="text-emerald-400 hover:text-emerald-600"
                        onClick={() => { setClienteSeleccionado(null); setBusquedaClienteNuevo(''); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Formulario de creación - solo si no hay cliente seleccionado */}
                  {!clienteSeleccionado && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                        <span className="text-xs text-zinc-400 font-medium">o crear nuevo</span>
                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                      </div>
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
              )}
            </div>
          ) : (
            <PasoProductoDeseado
              clienteWinfacId={tipoCliente === 'winfac' ? clienteSeleccionado?.id : undefined}
              clienteDeseadoId={tipoCliente !== 'winfac' ? Number(clienteSeleccionado?.id) : undefined}
              saving={saving}
              setSaving={setSaving}
              onGuardado={async () => {
                setModalOpen(false);
                resetModal();
                await refetchDeseados();
              }}
              onCancelar={() => setPasoModal('cliente')}
            />
          )}

          {pasoModal === 'cliente' && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setModalOpen(false); resetModal(); }}>
                Cancelar
              </Button>
              <Button onClick={() => setPasoModal('producto')} disabled={!paso1Valido}>
                Siguiente →
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {deseadoModalExterno && (
        <AgregarADeseadosModal
          open={deseadoModalExterno !== null}
          onOpenChange={open => {
            if (!open) {
              const alerta = alertasStock.find(a => a.codigo === deseadoModalExterno?.codigo);
              if (alerta) handleIgnorarAlerta(alerta.id);
              setDeseadoModalExterno(null);
            }
          }}
          codigo={deseadoModalExterno.codigo}
          descripcion={deseadoModalExterno.descripcion}
          esChina={true}
        />
      )}
    </div>
  );
}
