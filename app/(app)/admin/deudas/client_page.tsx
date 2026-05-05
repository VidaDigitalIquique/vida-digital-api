'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatMonto, tipoLabel, estadoBadge } from '../../deudas/deudas-utils';

type Deuda = {
  id: number;
  user_nombre: string;
  tipo: string;
  monto: string | number;
  descripcion: string | null;
  estado: string;
  solicitado_at: string;
  caduca_at: string;
  rechazado_motivo: string | null;
};

const ESTADOS = ['todos', 'pendiente', 'aceptada', 'confirmada', 'rechazada', 'caduca'];

export function AdminDeudasClient() {
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [rechazando, setRechazando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');

  const fetchDeudas = useCallback(async () => {
    setLoading(true);
    try {
      const params = filtroEstado !== 'todos' ? `?estado=${filtroEstado}` : '';
      const res = await fetch(`/api/deudas${params}`);
      if (res.ok) {
        const { deudas: d } = await res.json();
        setDeudas(d);
      }
    } catch {
      toast.error('Error cargando solicitudes');
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { fetchDeudas(); }, [fetchDeudas]);

  const ejecutarAccion = async (id: number, body: object) => {
    const res = await fetch(`/api/deudas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      fetchDeudas();
    } else {
      const { error } = await res.json();
      toast.error(error ?? 'Error');
    }
  };

  const handleAceptar = async (id: number) => {
    await ejecutarAccion(id, { accion: 'aceptar' });
    toast.success('Solicitud aceptada');
  };

  const handleRechazar = async (id: number) => {
    if (!motivo.trim()) { toast.error('Ingresa un motivo'); return; }
    await ejecutarAccion(id, { accion: 'rechazar', motivo: motivo.trim() });
    toast.success('Solicitud rechazada');
    setRechazando(null);
    setMotivo('');
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      <h1 className="text-3xl font-extrabold tracking-tight">Gestión de Deudas</h1>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filtroEstado === e
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 hover:border-blue-400'
            }`}
          >
            {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">Cargando...</div>
      ) : deudas.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center text-zinc-400 text-sm">
          No hay solicitudes.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {deudas.map(d => (
            <div key={d.id} className="bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{d.user_nombre}</span>
                    <span className="text-zinc-400">·</span>
                    <span>{tipoLabel(d.tipo)}</span>
                    <span className="font-mono font-medium">{formatMonto(parseFloat(String(d.monto)))}</span>
                  </div>
                  {d.descripcion && <p className="text-sm text-zinc-500">{d.descripcion}</p>}
                  <p className="text-xs text-zinc-400">
                    {new Date(d.solicitado_at).toLocaleDateString('es-CL')}
                    {d.estado === 'aceptada' && ` · Caduca: ${new Date(d.caduca_at).toLocaleDateString('es-CL')}`}
                  </p>
                  {d.rechazado_motivo && (
                    <p className="text-sm text-red-500">Motivo: {d.rechazado_motivo}</p>
                  )}
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(d.estado)}`}>
                  {d.estado}
                </span>
              </div>

              {d.estado === 'pendiente' && (
                rechazando === d.id ? (
                  <div className="flex gap-2 items-center flex-wrap">
                    <Input
                      placeholder="Motivo del rechazo"
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      className="flex-1 min-w-[180px]"
                      autoFocus
                    />
                    <Button size="sm" variant="destructive" onClick={() => handleRechazar(d.id)}>
                      Confirmar rechazo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRechazando(null); setMotivo(''); }}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAceptar(d.id)}>
                      Aceptar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRechazando(d.id); setMotivo(''); }}>
                      Rechazar
                    </Button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
