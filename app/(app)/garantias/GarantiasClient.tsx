'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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

export function GarantiasClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState('');
  const [mesAnio, setMesAnio] = useState(searchParams.get('mesAnio') ?? '');
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [loading, setLoading] = useState(true);

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
                  <td className="px-4 py-3 font-mono font-medium text-zinc-800 dark:text-zinc-200">{g.knumfoli}</td>
                  <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{g.cliente}</td>
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
    </div>
  );
}
