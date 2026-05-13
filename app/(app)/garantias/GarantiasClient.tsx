'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Plus, X, Clock } from 'lucide-react';

type Garantia = {
  id: number;
  knumfoli: string;
  cliente: string;
  monto: number;
  observaciones: string | null;
  estado: 'recibido' | 'devuelto';
  created_at: string;
  updated_at: string;
};

const formatCLP = (n: number) => '$' + n.toLocaleString('es-CL');

const ESTADO_CLASS: Record<string, string> = {
  recibido: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  devuelto: 'text-green-600 bg-green-50 dark:bg-green-900/20',
};

function estadoLabel(e: string) {
  return e === 'recibido' ? 'Recibido' : e === 'devuelto' ? 'Devuelto' : e;
}

const inp = 'w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

export function GarantiasClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState('');
  const [mesAnio, setMesAnio] = useState(searchParams.get('mesAnio') ?? '');
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newKnumfoli, setNewKnumfoli] = useState('');
  const [newCliente, setNewCliente] = useState('');
  const [newMonto, setNewMonto] = useState(0);
  const [newObservaciones, setNewObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState<{ id: number; campo: 'knumfoli' | 'cliente' | 'monto' | 'observaciones' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const autocompleteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGarantias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (mesAnio) {
        const [anio, mes] = mesAnio.split('-');
        params.set('mes', mes);
        params.set('anio', anio);
      }
      const res = await fetch(`/api/garantias?${params}`);
      const body = await res.json();
      setGarantias(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, mesAnio]);

  useEffect(() => { fetchGarantias(); }, [fetchGarantias]);

  const syncUrl = useCallback((m: string) => {
    const p = new URLSearchParams();
    if (m) p.set('mesAnio', m);
    const qs = p.toString();
    router.replace(pathname + (qs ? '?' + qs : ''), { scroll: false });
  }, [router, pathname]);

  const handleEstadoChange = async (g: Garantia, nuevoEstado: string) => {
    const r = await fetch(`/api/garantias/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo: 'estado', valor: nuevoEstado }),
    });
    if (r.ok) {
      toast.success(`Estado: ${estadoLabel(nuevoEstado)}`);
      await fetchGarantias();
    } else {
      toast.error('Error al actualizar estado');
    }
  };

  // ── Autocomplete ──────────────────────────────────────
  const autocompleteCliente = useCallback(async (knumfoli: string) => {
    if (!knumfoli.trim()) return;
    if (autocompleteRef.current) clearTimeout(autocompleteRef.current);
    autocompleteRef.current = setTimeout(async () => {
      const r = await fetch(`/api/garantias/autocomplete?knumfoli=${encodeURIComponent(knumfoli.trim())}`);
      const body = await r.json();
      if (body.cliente) {
        if (showModal) {
          setNewCliente(body.cliente);
          toast.success('Cliente autocompletado');
        } else if (editing) {
          setEditValue(body.cliente);
          toast.success('Cliente autocompletado');
        }
      }
    }, 400);
  }, [showModal, editing]);

  // ── Modal handlers ────────────────────────────────────
  const openModal = () => {
    setNewKnumfoli('');
    setNewCliente('');
    setNewMonto(0);
    setNewObservaciones('');
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!newKnumfoli.trim() || !newCliente.trim()) {
      toast.error('Nº Nota y Cliente son requeridos');
      return;
    }
    setSaving(true);
    const r = await fetch('/api/garantias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knumfoli: newKnumfoli.trim(), cliente: newCliente.trim(), monto: newMonto, observaciones: newObservaciones.trim() || null }),
    });
    if (r.ok) {
      toast.success('Garantía creada');
      setShowModal(false);
      await fetchGarantias();
    } else {
      toast.error('Error al crear garantía');
    }
    setSaving(false);
  };

  // ── Historial ─────────────────────────────────────────
  const [historialId, setHistorialId] = useState<number | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const openHistorial = async (garantiaId: number) => {
    setHistorialId(garantiaId);
    setLoadingLogs(true);
    try {
      const r = await fetch(`/api/garantias/${garantiaId}/log`);
      setLogs(await r.json());
    } finally {
      setLoadingLogs(false);
    }
  };

  // ── Inline edit handlers ──────────────────────────────
  const startEdit = (g: Garantia, campo: 'knumfoli' | 'cliente' | 'monto' | 'observaciones') => {
    setEditing({ id: g.id, campo });
    setEditValue(campo === 'monto' ? String(g.monto) : (g[campo] ?? ''));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editing.campo !== 'monto' && !editValue.trim()) return;
    const valor = editing.campo === 'monto' ? parseInt(editValue) || 0 : editValue.trim();
    const r = await fetch(`/api/garantias/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo: editing.campo, valor }),
    });
    if (r.ok) {
      toast.success('Actualizado');
      setEditing(null);
      setEditValue('');
      await fetchGarantias();
    } else {
      toast.error('Error al actualizar');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Garantías
          {!loading && <span className="ml-2 text-base font-normal text-zinc-400">({garantias.length})</span>}
        </h1>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-200 hover:bg-zinc-700 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva Garantía
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nota o cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={mesAnio}
          onChange={e => { setMesAnio(e.target.value); syncUrl(e.target.value); }}
          className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los meses</option>
          {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
        </div>
      ) : garantias.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 text-sm">No hay garantías registradas.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Nº Nota</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Hora</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-left">Obs.</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {garantias.map(g => (
                <tr key={g.id} className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                  <td className="px-4 py-3">
                    {editing?.id === g.id && editing?.campo === 'knumfoli' ? (
                      <input
                        className={cn(inp, 'font-mono text-sm w-28')}
                        value={editValue}
                        onChange={e => { setEditValue(e.target.value); autocompleteCliente(e.target.value); }}
                        onBlur={saveEdit}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(g, 'knumfoli')}
                        className="font-mono font-medium text-zinc-800 dark:text-zinc-200 hover:text-blue-600 cursor-pointer text-left"
                      >
                        {g.knumfoli}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing?.id === g.id && editing?.campo === 'cliente' ? (
                      <input
                        className={cn(inp, 'text-sm')}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(g, 'cliente')}
                        className="font-medium text-zinc-800 dark:text-zinc-200 hover:text-blue-600 cursor-pointer text-left"
                      >
                        {g.cliente}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {new Date(g.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {new Date(g.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing?.id === g.id && editing?.campo === 'monto' ? (
                      <input
                        type="number"
                        className={cn(inp, 'text-sm w-28 text-right')}
                        value={editValue}
                        onFocus={e => (e.target as HTMLInputElement).select()}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(g, 'monto')}
                        className="font-mono text-sm text-zinc-700 dark:text-zinc-300 hover:text-blue-600 cursor-pointer text-right w-full"
                      >
                        {formatCLP(g.monto)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {editing?.id === g.id && editing?.campo === 'observaciones' ? (
                      <input
                        className={cn(inp, 'text-sm w-36')}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(g, 'observaciones')}
                        className="text-zinc-500 hover:text-blue-600 cursor-pointer text-left max-w-[150px] truncate block"
                      >
                        {g.observaciones || '—'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={g.estado}
                      onChange={e => handleEstadoChange(g, e.target.value)}
                      className={cn(
                        'text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer',
                        ESTADO_CLASS[g.estado]
                      )}
                    >
                      <option value="recibido" className="text-red-600">Recibido</option>
                      <option value="devuelto" className="text-green-600">Devuelto</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openHistorial(g.id)}
                      className="text-zinc-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" /> Historial
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Historial Drawer ── */}
      {historialId && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setHistorialId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 h-full overflow-y-auto shadow-xl border-l border-zinc-200 dark:border-zinc-800 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Historial de cambios</h2>
              <button onClick={() => setHistorialId(null)} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
            </div>
            {loadingLogs ? (
              <div className="flex items-center justify-center py-10 text-zinc-400"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando…</div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">Sin eventos registrados.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((l: any) => (
                  <div key={l.id} className="border-l-2 border-zinc-200 dark:border-zinc-700 pl-3 text-sm space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 capitalize">{l.campo}</span>
                      <span className="text-zinc-400 text-xs">{new Date(l.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(l.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-zinc-500 text-xs">Por: {l.usuario}</p>
                    {l.valor_anterior !== null && (
                      <p className="text-zinc-400 text-xs line-through">{l.valor_anterior}</p>
                    )}
                    <p className="text-zinc-800 dark:text-zinc-200 text-xs">{l.valor_nuevo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Nueva Garantía ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Nueva Garantía</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Nº Nota de Venta</label>
              <input
                className={inp}
                placeholder="Nº Nota de Venta"
                value={newKnumfoli}
                onChange={e => { setNewKnumfoli(e.target.value); autocompleteCliente(e.target.value); }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Cliente</label>
              <input
                className={inp}
                placeholder="Nombre del cliente"
                value={newCliente}
                onChange={e => setNewCliente(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Monto (CLP)</label>
              <input
                type="number"
                className={inp}
                placeholder="0"
                value={newMonto || ''}
                onFocus={e => (e.target as HTMLInputElement).select()}
                onChange={e => setNewMonto(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Observaciones</label>
              <input
                className={inp}
                placeholder="Observaciones (opcional)"
                value={newObservaciones}
                onChange={e => setNewObservaciones(e.target.value)}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full py-2 rounded-lg bg-zinc-800 dark:bg-zinc-200 hover:bg-zinc-700 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
