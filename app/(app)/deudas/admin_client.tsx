'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatMonto, tipoLabel, estadoBadge } from './deudas-utils';

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
      } else {
        const { error } = await res.json();
        toast.error(error ?? 'Error al registrar pago');
      }
    } catch { toast.error('Error al registrar pago'); }
  };

  const prestamos = deudas.filter(d => d.tipo === 'prestamo');

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
            value={monto} onChange={e => setMonto(e.target.value)}
            className="w-36" required
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

      {/* Préstamos del trabajador */}
      {usuarioId && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg">
            Préstamos — {usuarios.find(u => u.id === usuarioId)?.nombre}
          </h2>
          {loading ? (
            <div className="py-8 text-center text-zinc-400 animate-pulse text-sm">Cargando...</div>
          ) : prestamos.length === 0 ? (
            <div className="border border-dashed rounded-xl p-8 text-center text-zinc-400 text-sm">
              Sin préstamos registrados.
            </div>
          ) : (
            prestamos.map(d => {
              const total = parseFloat(String(d.monto));
              const pagado = parseFloat(String(d.pagos_total));
              const saldo = total - pagado;
              return (
                <div key={d.id} className="bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold">{formatMonto(total)}</p>
                      {d.descripcion && <p className="text-sm text-zinc-500">{d.descripcion}</p>}
                      <p className="text-xs text-zinc-400">{d.mes}/{d.anio}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(d.estado)}`}>
                        {d.estado === 'aceptada' ? 'Pendiente confirmación' : d.estado}
                      </span>
                      {pagado > 0 && (
                        <p className="text-xs text-zinc-400">Pagado: {formatMonto(pagado)}</p>
                      )}
                      {saldo > 0 && d.estado === 'confirmada' && (
                        <p className="text-sm font-semibold text-red-600">Saldo: {formatMonto(saldo)}</p>
                      )}
                    </div>
                  </div>
                  {d.estado === 'confirmada' && saldo > 0 && (
                    pagandoId === d.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number" placeholder="Monto pago" min={0.01} step={0.01}
                          value={montoPago} onChange={e => setMontoPago(e.target.value)}
                          className="w-40"
                        />
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handlePago(d.id)}>
                          Confirmar pago
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setPagandoId(null); setMontoPago(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="self-start" onClick={() => setPagandoId(d.id)}>
                        Registrar pago
                      </Button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
