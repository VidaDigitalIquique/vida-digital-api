'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatMonto, tipoLabel, estadoBadge } from './deudas-utils';
import { useNumericInput } from '@/hooks/useNumericInput';

interface Usuario { id: number; nombre: string; }

interface Deuda {
  id: number;
  tipo: string;
  monto: string | number;
  descripcion: string | null;
  estado: string;
  mes: number;
  anio: number;
  pagos_total: string | number;
}

interface HistorialItem {
  deuda_id: number;
  pago_id: number | null;
  tipo: string;
  monto: string | number;
  descripcion: string | null;
  estado?: string;
  fecha_hora: string;
  item_tipo: 'deuda' | 'pago';
}

export function DeudasAdminClient() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioId, setUsuarioId] = useState<number | ''>('');
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState<'prestamo' | 'adelanto' | 'quincena'>('prestamo');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [pagandoId, setPagandoId] = useState<number | null>(null);
  const [montoPago, setMontoPago] = useState('');

  const montoProps = useNumericInput(monto, setMonto);
  const montoPagoProps = useNumericInput(montoPago, setMontoPago);
  const [historial, setHistorial] = useState<{ prestamos: HistorialItem[]; adelantos: HistorialItem[] }>({ prestamos: [], adelantos: [] });

  useEffect(() => {
    fetch('/api/admin/usuarios').then(r => r.json()).then(d => setUsuarios(d.data ?? []));
  }, []);

  const fetchDeudas = useCallback(async () => {
    if (!usuarioId) { setDeudas([]); return; }
    setLoading(true);
    fetch(`/api/deudas?usuario_id=${usuarioId}`)
      .then(r => r.json())
      .then(d => setDeudas(d.deudas ?? []))
      .finally(() => setLoading(false));
  }, [usuarioId]);

  useEffect(() => { fetchDeudas(); }, [fetchDeudas]);

  const fmtFechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fetchHistorial = useCallback(async () => {
    if (!usuarioId) { setHistorial({ prestamos: [], adelantos: [] }); return; }
    fetch(`/api/deudas/historial?usuario_id=${usuarioId}`)
      .then(r => r.json())
      .then(d => setHistorial({ prestamos: d.prestamos ?? [], adelantos: d.adelantos ?? [] }));
  }, [usuarioId]);

  useEffect(() => { fetchHistorial(); }, [fetchHistorial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioId || !monto) return;
    setSaving(true);
    try {
      const res = await fetch('/api/deudas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId,
          tipo,
          monto: parseFloat(monto),
          descripcion: descripcion.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Registrado');
        setMonto('');
        setDescripcion('');
        fetchDeudas();
        fetchHistorial();
      } else {
        const { error } = await res.json();
        toast.error(error?.message ?? 'Error al registrar');
      }
    } catch { toast.error('Error al registrar'); }
    finally { setSaving(false); }
  };

  const handlePago = async (deudaId: number) => {
    const montoNum = parseFloat(montoPago);
    if (!montoNum || montoNum <= 0) { toast.error('Monto inválido'); return; }
    try {
      const res = await fetch(`/api/deudas/${deudaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'pagar', monto: montoNum }),
      });
      if (res.ok) {
        toast.success('Pago registrado');
        setMontoPago('');
        setPagandoId(null);
        fetchDeudas();
        fetchHistorial();
      } else {
        const { error } = await res.json();
        toast.error(error ?? 'Error al registrar pago');
      }
    } catch { toast.error('Error al registrar pago'); }
  };

  const handleDeleteItem = async (item: HistorialItem) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const url = item.item_tipo === 'pago'
      ? `/api/deudas/pagos/${item.pago_id}`
      : `/api/deudas/${item.deuda_id}`;
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminado'); fetchDeudas(); fetchHistorial(); }
      else { const { error } = await res.json(); toast.error(error ?? 'Error al eliminar'); }
    } catch { toast.error('Error al eliminar'); }
  };

  const totalDeuda = deudas
    .filter(d => !['rechazada', 'caduca'].includes(d.estado))
    .reduce((acc, d) => acc + parseFloat(String(d.monto)) - parseFloat(String(d.pagos_total)), 0);

  const prestamoConSaldo = usuarioId ? deudas.find(d => {
    const t = parseFloat(String(d.monto));
    const p = parseFloat(String(d.pagos_total));
    return d.tipo === 'prestamo' && ['confirmada', 'aceptada'].includes(d.estado) && (t - p) > 0;
  }) : undefined;

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      <h1 className="text-3xl font-extrabold tracking-tight">Deudas</h1>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Registrar movimiento</h2>
        <div className="flex flex-wrap gap-3">
          <select
            className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-800 min-w-[180px]"
            value={usuarioId}
            onChange={e => setUsuarioId(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">Seleccionar trabajador...</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value as typeof tipo)}
            className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-800"
          >
            <option value="prestamo">Préstamo</option>
            <option value="adelanto">Adelanto</option>
            <option value="quincena">Quincena</option>
          </select>
          <Input
            type="number" placeholder="Monto" min={0.01} step={0.01}
            className="w-36" required
            {...montoProps}
          />
          <Input
            placeholder="Descripción (opcional)"
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            className="flex-1 min-w-[160px]"
          />
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </div>
      </form>

      {/* Saldo total del trabajador */}
      {usuarioId && (
        <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm">
          <p className="text-sm text-zinc-500 mb-1">
            Deuda total — {usuarios.find(u => u.id === usuarioId)?.nombre}
          </p>
          <p className={`text-5xl font-extrabold tracking-tight ${totalDeuda > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatMonto(totalDeuda)}
          </p>
        </div>
      )}

      {/* Historial unificado */}
      {usuarioId && (
        <div className="flex flex-col gap-4">
          {/* Tarjeta Préstamos */}
          <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-lg">Préstamos</h2>
              {prestamoConSaldo && (pagandoId === prestamoConSaldo.id ? (
                <div className="flex gap-2">
                  <Input type="number" placeholder="Monto pago" min={0.01} step={0.01} className="w-36" {...montoPagoProps} />
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handlePago(prestamoConSaldo.id)}>Confirmar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setPagandoId(null); setMontoPago(''); }}>Cancelar</Button>
                </div>
              ) : (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setPagandoId(prestamoConSaldo.id)}>Registrar pago</Button>
              ))}
            </div>
            {loading ? (
              <p className="p-5 text-sm text-zinc-400 animate-pulse">Cargando...</p>
            ) : historial.prestamos.length === 0 ? (
              <p className="p-5 text-sm text-zinc-400">Sin préstamos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha/Hora</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-left">Descripción</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {historial.prestamos.map((item, i) => (
                    <tr key={i} className={item.item_tipo === 'pago' ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''}>
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{fmtFechaHora(item.fecha_hora)}</td>
                      <td className="px-4 py-3">{item.tipo === 'pago' ? 'Pago' : tipoLabel(item.tipo)}</td>
                      <td className="px-4 py-3">{item.estado ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge(item.estado)}`}>{item.estado}</span> : '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMonto(parseFloat(String(item.monto)))}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.descripcion || '—'}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteItem(item)} className="text-xs text-red-500 hover:text-red-700">Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Tarjeta Adelantos y Quincenas */}
          <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold text-lg">Adelantos y Quincenas</h2>
            </div>
            {loading ? (
              <p className="p-5 text-sm text-zinc-400 animate-pulse">Cargando...</p>
            ) : historial.adelantos.length === 0 ? (
              <p className="p-5 text-sm text-zinc-400">Sin adelantos ni quincenas registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha/Hora</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-left">Descripción</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {historial.adelantos.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{fmtFechaHora(item.fecha_hora)}</td>
                      <td className="px-4 py-3">{item.tipo === 'pago' ? 'Pago' : tipoLabel(item.tipo)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMonto(parseFloat(String(item.monto)))}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.descripcion || '—'}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteItem(item)} className="text-xs text-red-500 hover:text-red-700">Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
