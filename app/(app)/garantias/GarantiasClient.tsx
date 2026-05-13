'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';

type Garantia = {
  id: number;
  knumfoli: string;
  cliente: string;
  estado: 'recibido' | 'devuelto';
  created_at: string;
  updated_at: string;
};

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
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState<{ id: number; campo: 'knumfoli' | 'cliente' } | null>(null);
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
      body: JSON.stringify({ knumfoli: newKnumfoli.trim(), cliente: newCliente.trim() }),
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

  // ── Inline edit handlers ──────────────────────────────
  const startEdit = (g: Garantia, campo: 'knumfoli' | 'cliente') => {
    setEditing({ id: g.id, campo });
    setEditValue(g[campo]);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editing || !editValue.trim()) return;
    const r = await fetch(`/api/garantias/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo: editing.campo, valor: editValue.trim() }),
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
                <th className="px-4 py-3 text-left">Estado</th>
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
                </tr>
              ))}
            </tbody>
          </table>
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
