'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatMonto, saldoColor, buildWhatsAppText, formatFecha } from './pettycash-utils';
import { useNumericInput } from '@/hooks/useNumericInput';

type Movimiento = {
  id: number;
  fecha: string;
  created_at: string;
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  monto: number;
  creado_por: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function PettycashClient({ isAdmin = false }: { isAdmin?: boolean }) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesde, setFiltroDesde] = useState(firstDayOfMonth);
  const [filtroHasta, setFiltroHasta] = useState(lastDayOfMonth);

  // Formulario
  const [formTipo, setFormTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [formConcepto, setFormConcepto] = useState('Pettycash');
  const [formMonto, setFormMonto] = useState('');

  const handleTipoChange = (newTipo: 'ingreso' | 'egreso') => {
    setFormTipo(newTipo);
    if (newTipo === 'ingreso' && formConcepto === '') setFormConcepto('Pettycash');
    if (newTipo === 'egreso' && formConcepto === 'Pettycash') setFormConcepto('');
  };
  const [formFecha, setFormFecha] = useState(today());

  const [editTarget, setEditTarget] = useState<Movimiento | null>(null);
  const [editForm, setEditForm] = useState({ tipo: 'ingreso' as 'ingreso' | 'egreso', concepto: '', monto: '', fecha: '' });

  const formMontoProps = useNumericInput(formMonto, setFormMonto);
  const editMontoProps = useNumericInput(editForm.monto, v => setEditForm(f => ({ ...f, monto: v })));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchMovimientos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroDesde) params.set('desde', filtroDesde);
      if (filtroHasta) params.set('hasta', filtroHasta);
      const res = await fetch(`/api/pettycash?${params}`);
      if (res.ok) {
        const { data, saldo: s } = await res.json();
        setMovimientos(data);
        setSaldo(s);
      }
    } catch {
      toast.error('Error cargando movimientos');
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, filtroDesde, filtroHasta]);

  useEffect(() => { fetchMovimientos(); }, [fetchMovimientos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(formMonto);
    if (!formConcepto.trim() || !monto || monto <= 0) {
      toast.error('Completá todos los campos correctamente');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/pettycash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: formTipo, concepto: formConcepto.trim(), monto, fecha: formFecha }),
      });
      if (res.ok) {
        toast.success('Movimiento registrado');
        setFormConcepto(formTipo === 'ingreso' ? 'Pettycash' : '');
        setFormMonto('');
        setFormFecha(today());
        fetchMovimientos();
      } else {
        const { error } = await res.json();
        toast.error(error?.message ?? 'Error al guardar');
      }
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m: Movimiento) => {
    setEditTarget(m);
    setEditForm({ tipo: m.tipo, concepto: m.concepto, monto: String(m.monto), fecha: String(m.fecha).slice(0, 10) });
  };

  const handleSave = async () => {
    if (!editTarget) return;
    const monto = parseFloat(editForm.monto);
    if (!editForm.concepto.trim() || !monto || monto <= 0) { toast.error('Completá todos los campos'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/pettycash/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: editForm.tipo, concepto: editForm.concepto.trim(), monto, fecha: editForm.fecha }),
      });
      if (res.ok) { toast.success('Movimiento actualizado'); setEditTarget(null); fetchMovimientos(); }
      else { const { error } = await res.json(); toast.error(typeof error === 'string' ? error : 'Error al guardar'); }
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pettycash/${editTarget.id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Movimiento eliminado'); setConfirmDelete(false); setEditTarget(null); fetchMovimientos(); }
      else { toast.error('Error al eliminar'); }
    } catch { toast.error('Error al eliminar'); }
    finally { setSaving(false); }
  };

  const handlePrint = () => window.print();

  const handleWhatsApp = async () => {
    const text = buildWhatsAppText(movimientos, saldo, filtroDesde, filtroHasta);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      {/* Layout solo impresión */}
      <div className="hidden print:block text-sm">
        <h1 className="text-xl font-bold mb-1">Pettycash</h1>
        {filtroDesde && filtroHasta && (
          <p className="text-zinc-500 mb-1">Período: {filtroDesde} – {filtroHasta}</p>
        )}
        <p className="font-semibold mb-4">Saldo: {formatMonto(saldo)}</p>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 pr-3">Fecha</th>
              <th className="text-left py-1 pr-3">Hora</th>
              <th className="text-left py-1 pr-3">Tipo</th>
              <th className="text-left py-1 pr-3">Concepto</th>
              <th className="text-right py-1">Monto</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map(m => (
              <tr key={m.id} className="border-b border-zinc-100">
                <td className="py-1 pr-3">{formatFecha(m.fecha)}</td>
                <td className="py-1 pr-3">{m.created_at ? new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className="py-1 pr-3">{m.tipo === 'egreso' ? 'Gasto' : 'Ingreso'}</td>
                <td className="py-1 pr-3">{m.concepto}</td>
                <td className={`py-1 text-right ${m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {m.tipo === 'egreso' ? '-' : ''}{formatMonto(parseFloat(String(m.monto)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="print:hidden flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Pettycash</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>🖨️ Imprimir</Button>
          <Button variant="outline" size="sm" onClick={handleWhatsApp}>📲 WhatsApp</Button>
        </div>
      </div>

      {/* Saldo */}
      <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm flex flex-col gap-1">
        <p className="text-sm text-zinc-500">Saldo actual</p>
        <p className={`text-4xl font-bold ${saldoColor(saldo)}`}>{formatMonto(saldo)}</p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Nuevo movimiento</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={formTipo}
            onChange={e => handleTipoChange(e.target.value as 'ingreso' | 'egreso')}
            className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-800"
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Gasto</option>
          </select>
          <Input
            placeholder="Concepto"
            value={formConcepto}
            onChange={e => setFormConcepto(e.target.value)}
            className="flex-1 min-w-[180px]"
          />
          <Input
            type="number"
            placeholder="Monto"
            min={0.01}
            step={0.01}
            className="w-36"
            {...formMontoProps}
          />
          <Input
            type="date"
            value={formFecha}
            onChange={e => setFormFecha(e.target.value)}
            className="w-40"
          />
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? 'Guardando...' : 'Agregar'}
          </Button>
        </div>
      </form>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-800"
        >
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Gastos</option>
        </select>
        <Input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="w-40" placeholder="Desde" />
        <Input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} className="w-40" placeholder="Hasta" />
        <Button variant="outline" onClick={() => { setFiltroTipo(''); setFiltroDesde(firstDayOfMonth()); setFiltroHasta(lastDayOfMonth()); }}>
          Limpiar
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">Cargando...</div>
      ) : movimientos.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center text-zinc-400 text-sm">
          No hay movimientos registrados.
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Hora</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Concepto</th>
                <th className="px-4 py-3 text-right">Monto</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {movimientos.map(m => (
                <tr key={m.id} className={`transition-colors ${m.tipo === 'ingreso' ? 'bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20' : 'bg-red-50/60 hover:bg-red-100/60 dark:bg-red-900/10 dark:hover:bg-red-900/20'}`}>
                  <td className="px-4 py-3 text-zinc-500">{formatFecha(m.fecha)}</td>
                  <td className="px-4 py-3 text-zinc-500">{m.created_at ? new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.tipo === 'ingreso'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {m.tipo === 'egreso' ? 'gasto' : m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">{m.concepto}</td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {m.tipo === 'egreso' ? '-' : ''}{formatMonto(parseFloat(String(m.monto)))}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        aria-label="Editar registro"
                        onClick={() => openEdit(m)}
                        className="text-zinc-400 hover:text-blue-600 transition-colors"
                      >
                        ✏️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Modal editar */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Editar movimiento</h2>
            <div className="flex flex-col gap-3">
              <select
                value={editForm.tipo}
                onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value as 'ingreso' | 'egreso' }))}
                className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-800"
              >
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Gasto</option>
              </select>
              <Input placeholder="Concepto" value={editForm.concepto} onChange={e => setEditForm(f => ({ ...f, concepto: e.target.value }))} />
              <Input type="number" placeholder="Monto" min={0.01} step={0.01} {...editMontoProps} />
              <Input type="date" value={editForm.fecha} onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="flex justify-between gap-2 mt-2">
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>Eliminar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
                <Button disabled={saving} onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl p-6 flex flex-col gap-4 max-w-sm w-full mx-4">
            <p className="font-medium">¿Eliminar este movimiento?</p>
            <p className="text-sm text-zinc-500">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="destructive" disabled={saving} onClick={handleDelete}>
                {saving ? 'Eliminando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
