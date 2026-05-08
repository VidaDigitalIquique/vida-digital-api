'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Nota = {
  empresa: 'vida' | 'sanjh';
  knumfoli: string;
  fechanvt: string;
  vendedor: string;
  cliente_comprador: { nombress: string; ciudad: string };
  seguimiento: { prioridad: string; ultima_interaccion: string | null; proximo_contacto: string | null } | null;
};

const diasDesde = (fecha: string) => Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);

const PRI_COLOR: Record<string, string> = {
  alta:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  normal: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  baja:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};
const EMP_COLOR: Record<string, string> = {
  vida:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  sanjh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export function SeguimientosClient() {
  const [empresa, setEmpresa] = useState('ambas');
  const [vendedor, setVendedor] = useState('');
  const [mesAnio, setMesAnio] = useState('');
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ empresa, limit: '200' });
      if (mesAnio) {
        const [anio, mes] = mesAnio.split('-');
        params.set('mes', mes);
        params.set('anio', anio);
      }
      const res = await fetch(`/api/seguimientos?${params}`);
      const body = await res.json();
      setNotas(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [empresa, mesAnio]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  const visible = notas.filter(n =>
    !vendedor.trim() || (n.vendedor ?? '').toLowerCase().includes(vendedor.toLowerCase())
  );

  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
    };
  });

  const tabs = [
    { value: 'ambas', label: 'Ambas' },
    { value: 'vida',  label: 'Vida Digital' },
    { value: 'sanjh', label: 'Sanjh' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Seguimientos
          {!loading && <span className="ml-2 text-base font-normal text-zinc-400">({visible.length})</span>}
        </h1>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg">
          {tabs.map(t => (
            <button key={t.value} onClick={() => setEmpresa(t.value)}
              className={cn('px-3 py-1.5 rounded text-sm font-medium transition-all',
                empresa === t.value
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Filtrar por vendedor…" value={vendedor}
          onChange={e => setVendedor(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={mesAnio} onChange={e => setMesAnio(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los meses</option>
          {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando notas…
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 text-sm">No hay notas sin visar.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Folio</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Días</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Vendedor</th>
                <th className="px-4 py-3 text-left">Último contacto</th>
                <th className="px-4 py-3 text-left">Próximo</th>
                <th className="px-4 py-3 text-left">Prioridad</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visible.map(n => {
                const dias = diasDesde(n.fechanvt);
                const pri = n.seguimiento?.prioridad ?? 'normal';
                return (
                  <tr key={`${n.empresa}-${n.knumfoli}`}
                    className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{n.knumfoli}</div>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block', EMP_COLOR[n.empresa])}>
                        {n.empresa === 'vida' ? 'Vida' : 'Sanjh'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{new Date(n.fechanvt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      <span className={dias > 30 ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'}>
                        {dias}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{n.cliente_comprador.nombress}</div>
                      <div className="text-xs text-zinc-400">{n.cliente_comprador.ciudad}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{n.vendedor}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {n.seguimiento?.ultima_interaccion
                        ? <span className="text-zinc-500">{new Date(n.seguimiento.ultima_interaccion).toLocaleDateString('es-CL')}</span>
                        : <span className="text-zinc-400 italic text-xs">Sin contacto</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                      {n.seguimiento?.proximo_contacto
                        ? new Date(n.seguimiento.proximo_contacto).toLocaleDateString('es-CL')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded-full capitalize', PRI_COLOR[pri])}>
                        {pri}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/seguimientos/${n.empresa}/${n.knumfoli}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium whitespace-nowrap">
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
