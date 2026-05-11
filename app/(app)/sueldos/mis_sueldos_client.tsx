'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatMonto } from '../pettycash/pettycash-utils';
import { nombreMes } from './sueldos-utils';

type Sueldo = {
  id: number;
  trabajador_nombre: string;
  mes: number;
  anio: number;
  monto_base: number;
  monto_final: number;
  pagado_at: string | null;
  confirmado_at: string | null;
};

export function SueldosUserClient() {
  const [sueldos, setSueldos] = useState<Sueldo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSueldos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sueldos');
      if (res.ok) {
        const { sueldos } = await res.json();
        setSueldos(sueldos ?? []);
      }
    } catch {
      toast.error('Error cargando sueldos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSueldos(); }, [fetchSueldos]);

  const handleConfirmar = async (id: number) => {
    try {
      const res = await fetch(`/api/sueldos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'confirmar' }),
      });
      if (res.ok) {
        toast.success('Recepción confirmada');
        fetchSueldos();
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
      <h1 className="text-3xl font-extrabold tracking-tight">Mis Sueldos</h1>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">Cargando...</div>
      ) : sueldos.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center text-zinc-400 text-sm">
          No tenés sueldos registrados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sueldos.map(s => (
            <div key={s.id} className="bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-lg">{nombreMes(s.mes)} {s.anio}</p>
                  <p className="text-sm text-zinc-500">
                    Base: {formatMonto(s.monto_base)} · Final: {formatMonto(s.monto_final)}
                  </p>
                </div>
                {s.confirmado_at ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    Confirmado
                  </span>
                ) : s.pagado_at ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    Pendiente tu confirmación
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">
                    Pendiente de pago
                  </span>
                )}
              </div>

              {s.pagado_at && !s.confirmado_at && (
                <Button
                  size="sm"
                  className="self-start bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleConfirmar(s.id)}
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
