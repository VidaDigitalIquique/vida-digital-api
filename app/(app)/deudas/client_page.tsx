'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatMonto, tipoLabel, estadoBadge } from './deudas-utils';

type Deuda = {
  id: number;
  tipo: string;
  monto: string | number;
  descripcion: string | null;
  estado: string;
  solicitado_at: string;
  caduca_at: string;
  rechazado_motivo: string | null;
};

export function DeudasUserClient() {
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState<'prestamo' | 'adelanto' | 'quincena'>('prestamo');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const fetchDeudas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deudas');
      if (res.ok) {
        const { deudas: d } = await res.json();
        setDeudas(d);
      }
    } catch {
      toast.error('Error cargando solicitudes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeudas(); }, [fetchDeudas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) { toast.error('Ingresa un monto válido'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/deudas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, monto: montoNum, descripcion: descripcion.trim() || undefined }),
      });
      if (res.ok) {
        toast.success('Solicitud enviada');
        setMonto('');
        setDescripcion('');
        fetchDeudas();
      } else {
        const { error } = await res.json();
        toast.error(error?.message ?? 'Error al enviar');
      }
    } catch {
      toast.error('Error al enviar');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmar = async (id: number) => {
    try {
      const res = await fetch(`/api/deudas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'confirmar' }),
      });
      if (res.ok) {
        toast.success('Recepción confirmada');
        fetchDeudas();
      } else {
        const { error } = await res.json();
        toast.error(error ?? 'Error al confirmar');
      }
    } catch {
      toast.error('Error al confirmar');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      <h1 className="text-3xl font-extrabold tracking-tight">Mis Solicitudes</h1>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Nueva solicitud</h2>
        <div className="flex flex-wrap gap-3">
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
            type="number"
            placeholder="Monto"
            min={0.01}
            step={0.01}
            value={monto}
            onChange={e => setMonto(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className="flex-1 min-w-[180px]"
          />
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? 'Enviando...' : 'Solicitar'}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">Cargando...</div>
      ) : deudas.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center text-zinc-400 text-sm">
          No tienes solicitudes aún.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {deudas.map(d => (
            <div key={d.id} className="bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{tipoLabel(d.tipo)}</span>
                  <span className="font-mono font-medium">{formatMonto(parseFloat(String(d.monto)))}</span>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(d.estado)}`}>
                  {d.estado}
                </span>
              </div>
              {d.descripcion && <p className="text-sm text-zinc-500">{d.descripcion}</p>}
              {d.rechazado_motivo && (
                <p className="text-sm text-red-500">Motivo: {d.rechazado_motivo}</p>
              )}
              <p className="text-xs text-zinc-400">
                Solicitado: {new Date(d.solicitado_at).toLocaleDateString('es-CL')}
                {d.estado === 'aceptada' && ` · Caduca: ${new Date(d.caduca_at).toLocaleDateString('es-CL')}`}
              </p>
              {d.estado === 'aceptada' && (
                <Button
                  size="sm"
                  className="self-start bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleConfirmar(d.id)}
                >
                  Confirmar recepción
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
