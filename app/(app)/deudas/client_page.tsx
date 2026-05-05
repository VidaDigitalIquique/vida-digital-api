'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatMonto, estadoBadge } from './deudas-utils';

type Prestamo = {
  id: number;
  monto: string | number;
  descripcion: string | null;
  estado: string;
  solicitado_at: string;
  pagos_total: string | number;
};

export function DeudasUserClient() {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPrestamos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deudas');
      if (res.ok) {
        const { deudas } = await res.json();
        setPrestamos(deudas ?? []);
      }
    } catch {
      toast.error('Error cargando préstamos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrestamos(); }, [fetchPrestamos]);

  const handleConfirmar = async (id: number) => {
    try {
      const res = await fetch(`/api/deudas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'confirmar' }),
      });
      if (res.ok) {
        toast.success('Recepción confirmada');
        fetchPrestamos();
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
      <h1 className="text-3xl font-extrabold tracking-tight">Mis Préstamos</h1>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">Cargando...</div>
      ) : prestamos.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center text-zinc-400 text-sm">
          No tenés préstamos registrados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {prestamos.map(p => {
            const total  = parseFloat(String(p.monto));
            const pagado = parseFloat(String(p.pagos_total));
            const saldo  = total - pagado;
            return (
              <div key={p.id} className="bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-lg">{formatMonto(total)}</p>
                    {p.descripcion && <p className="text-sm text-zinc-500">{p.descripcion}</p>}
                    <p className="text-xs text-zinc-400">
                      {new Date(p.solicitado_at).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(p.estado)}`}>
                    {p.estado === 'aceptada' ? 'Pendiente tu confirmación' : p.estado}
                  </span>
                </div>

                {p.estado === 'confirmada' && (
                  <div className="flex gap-4 text-sm">
                    {pagado > 0 && <span className="text-emerald-600">Pagado: {formatMonto(pagado)}</span>}
                    <span className={saldo > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                      {saldo > 0 ? `Saldo: ${formatMonto(saldo)}` : 'Cancelado'}
                    </span>
                  </div>
                )}

                {p.estado === 'aceptada' && (
                  <Button
                    size="sm"
                    className="self-start bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleConfirmar(p.id)}
                  >
                    Confirmar recepción
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
