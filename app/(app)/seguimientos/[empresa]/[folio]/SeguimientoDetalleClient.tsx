'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Loader2, ArrowLeft, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = ['llamada', 'whatsapp', 'email', 'visita', 'nota'] as const;
const diasDesde = (f: string) => Math.floor((Date.now() - new Date(f).getTime()) / 86400000);

function extractCodigo(item: any): string {
  if (item.codigo) return item.codigo;
  const match = item.descrip?.match(/\s{2}([A-Z0-9][A-Z0-9\-\.\/]+)\s{2}/);
  return match ? match[1] : '—';
}
const card = 'bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3';
const inp = 'w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
const lbl = 'block text-xs font-medium text-zinc-500 mb-1';

export function SeguimientoDetalleClient({ empresa, folio }: { empresa: string; folio: string }) {
  const router = useRouter();
  const [nota, setNota] = useState<any>(null);
  const [segId, setSegId] = useState<number | null>(null);
  const [seg, setSeg] = useState({ prioridad: 'normal', estado: 'activo', asignado_a: null as number | null, notas_internas: '' });
  const [ints, setInts] = useState<any[]>([]);
  const [nInt, setNInt] = useState({ tipo: 'llamada', resultado: '', proximo_contacto: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingInt, setSavingInt] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchInts = useCallback(async (id: number) => {
    const r = await fetch(`/api/seguimientos/${id}/interacciones`);
    setInts(await r.json());
  }, []);

  const fetchDetalle = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/seguimientos?empresa=${empresa}&knumfoli=${encodeURIComponent(folio)}&limit=1`);
    const body = await r.json();
    const n = body.data?.[0];
    if (!n) { setNotFound(true); setLoading(false); return; }
    setNota(n);
    let sid = n.seguimiento?.id ?? null;
    if (!sid) {
      const cr = await fetch('/api/seguimientos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa, knumfoli: folio }) });
      sid = (await cr.json()).id;
      setInts([]);
    } else {
      setSeg({ prioridad: n.seguimiento.prioridad, estado: n.seguimiento.estado, asignado_a: n.seguimiento.asignado_a, notas_internas: n.seguimiento.notas_internas ?? '' });
      await fetchInts(sid);
    }
    setSegId(sid);
    setLoading(false);
  }, [empresa, folio, fetchInts]);

  useEffect(() => { fetchDetalle(); }, [fetchDetalle]);

  const handlePatch = async () => {
    if (!segId) return;
    setSaving(true);
    const r = await fetch(`/api/seguimientos/${segId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seg) });
    toast[r.ok ? 'success' : 'error'](r.ok ? 'Guardado' : 'Error al guardar');
    setSaving(false);
  };

  const handleNuevaInt = async () => {
    if (!segId) return;
    setSavingInt(true);
    const r = await fetch(`/api/seguimientos/${segId}/interacciones`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: nInt.tipo, resultado: nInt.resultado || null, proximo_contacto: nInt.proximo_contacto || null }),
    });
    if (r.ok) { toast.success('Interacción registrada'); setNInt({ tipo: 'llamada', resultado: '', proximo_contacto: '' }); await fetchInts(segId); }
    else toast.error('Error al registrar');
    setSavingInt(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-zinc-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando…</div>;
  if (notFound) return <div className="text-center py-20 text-zinc-400 text-sm">Nota no encontrada.</div>;

  const c = nota.cliente_comprador;
  const dias = diasDesde(nota.fechanvt);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="mt-1 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">{nota.knumfoli}</h1>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', nota.empresa === 'vida' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
              {nota.empresa === 'vida' ? 'Vida Digital' : 'Sanjh'}
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {new Date(nota.fechanvt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })} · Vendedor: {nota.vendedor} ·{' '}
            <span className={cn('font-semibold', dias > 30 ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400')}>{dias} días</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda: datos de la nota */}
        <div className="space-y-4">
          <div className={card}>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cliente comprador</h2>
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">{c.nombress}</p>
            <div className="text-sm space-y-1 text-zinc-600 dark:text-zinc-400">
              {c.celular && <a href={`https://wa.me/${c.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-green-600 dark:text-green-500 hover:underline w-fit">
                <MessageCircle className="w-4 h-4" />{c.celular}
              </a>}
              {c.email01 && <div>{c.email01}</div>}
              {c.ciudad && <div className="text-zinc-400">{c.ciudad}</div>}
            </div>
          </div>

          {nota.cliente_factura && (
            <div className={card}>
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cliente factura</h2>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{nota.cliente_factura.nombress}</p>
            </div>
          )}

          {nota.items?.length > 0 && (
            <div className={cn(card, 'overflow-x-auto')}>
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ítems ({nota.items.length})</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase tracking-wide">
                    <th className="py-2 pr-3 text-left font-medium">Código</th>
                    <th className="py-2 pr-3 text-left font-medium">Descripción</th>
                    <th className="py-2 pr-3 text-right font-medium">Bultos</th>
                    <th className="py-2 pr-3 text-right font-medium">Packing</th>
                    <th className="py-2 pr-3 text-right font-medium">Cantidad</th>
                    <th className="py-2 pr-3 text-right font-medium">Precio Unit.</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {nota.items.map((item: any, i: number) => (
                    <tr key={i} className="text-zinc-700 dark:text-zinc-300">
                      <td className="py-1.5 pr-3 font-mono text-zinc-400">{extractCodigo(item)}</td>
                      <td className="py-1.5 pr-3">{item.descrip}</td>
                      <td className="py-1.5 pr-3 text-right">{item.tcancaja ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right">{item.cantxcaja ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {item.tcancaja != null && item.cantxcaja != null ? item.tcancaja * item.cantxcaja : '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-zinc-500">USD {Number(item.precread ?? 0).toFixed(2)}</td>
                      <td className="py-1.5 text-right text-zinc-500">USD {Number(item.totaldoc ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-800 dark:text-zinc-200">
                    <td colSpan={6} className="py-2 pr-3 text-right">TOTAL</td>
                    <td className="py-2 text-right">USD {nota.items.reduce((s: number, i: any) => s + Number(i.totaldoc ?? 0), 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Columna derecha: gestión */}
        <div className="space-y-4">
          <div className={card}>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Seguimiento</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Prioridad</label>
                <select value={seg.prioridad} onChange={e => setSeg(s => ({ ...s, prioridad: e.target.value }))} className={inp}>
                  <option value="alta">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Estado</label>
                <select value={seg.estado} onChange={e => setSeg(s => ({ ...s, estado: e.target.value }))} className={inp}>
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Asignado a (ID usuario)</label>
              <input type="number" value={seg.asignado_a ?? ''} onChange={e => setSeg(s => ({ ...s, asignado_a: e.target.value ? parseInt(e.target.value) : null }))} className={inp} placeholder="ID usuario" />
            </div>
            <div>
              <label className={lbl}>Notas internas</label>
              <textarea value={seg.notas_internas} onChange={e => setSeg(s => ({ ...s, notas_internas: e.target.value }))}
                rows={3} className={cn(inp, 'resize-none')} placeholder="Observaciones internas…" />
            </div>
            <button onClick={handlePatch} disabled={saving}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>

          <div className={card}>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Nueva interacción</h2>
            <div>
              <label className={lbl}>Tipo</label>
              <select value={nInt.tipo} onChange={e => setNInt(s => ({ ...s, tipo: e.target.value }))} className={inp}>
                {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Resultado</label>
              <textarea value={nInt.resultado} onChange={e => setNInt(s => ({ ...s, resultado: e.target.value }))}
                rows={2} className={cn(inp, 'resize-none')} placeholder="¿Cómo fue el contacto?" />
            </div>
            <div>
              <label className={lbl}>Próximo contacto</label>
              <input type="date" value={nInt.proximo_contacto} onChange={e => setNInt(s => ({ ...s, proximo_contacto: e.target.value }))} className={inp} />
            </div>
            <button onClick={handleNuevaInt} disabled={savingInt}
              className="w-full py-2 rounded-lg bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {savingInt ? 'Registrando…' : 'Registrar interacción'}
            </button>
          </div>

          <div className={card}>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Historial ({ints.length})</h2>
            {ints.length === 0
              ? <p className="text-sm text-zinc-400 italic">Sin interacciones aún.</p>
              : <div className="space-y-3">
                  {ints.map((i: any) => (
                    <div key={i.id} className="text-sm border-l-2 border-zinc-200 dark:border-zinc-700 pl-3 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 capitalize">{i.tipo}</span>
                        <span className="text-zinc-400 text-xs">{new Date(i.created_at).toLocaleDateString('es-CL')}</span>
                      </div>
                      {i.resultado && <p className="text-zinc-500">{i.resultado}</p>}
                      {i.proximo_contacto && <p className="text-xs text-blue-500">Próximo: {i.proximo_contacto}</p>}
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
