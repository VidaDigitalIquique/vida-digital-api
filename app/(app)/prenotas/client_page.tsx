'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, PlusCircle, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Prenota = {
  id: number;
  titulo: string;
  created_at: string;
  nombre_cliente: string | null;
};

export function PrenotasPage({ session }: { session: any }) {
  const router = useRouter();
  const rol = (session?.user as any)?.rol;
  const [prenotas, setPrenotas] = useState<Prenota[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchPrenotas() {
      setLoading(true);
      try {
        const res = await fetch('/api/prenotas');
        if (res.ok) {
          const { data } = await res.json();
          setPrenotas(data || []);
        } else {
          toast.error('Error cargando pre-notas');
        }
      } catch {
        toast.error('Error cargando pre-notas');
      } finally {
        setLoading(false);
      }
    }

    fetchPrenotas();
  }, []);

  const handleCrear = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/prenotas', { method: 'POST' });
      if (!res.ok) {
        toast.error('No se pudo crear la pre-nota');
        return;
      }
      const data = await res.json();
      router.push(`/prenotas/${data.id}`);
    } catch {
      toast.error('No se pudo crear la pre-nota');
    } finally {
      setCreating(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta pre-nota?')) return;
    try {
      const res = await fetch(`/api/prenotas/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('No se pudo eliminar');
        return;
      }
      setPrenotas(prev => prev.filter(p => p.id !== id));
      toast.success('Pre-nota eliminada');
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const formatFecha = (value: string) =>
    new Date(value).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Pre-Notas</h1>
          <p className="text-zinc-500 mt-1">Borradores de venta para preparar cotizaciones y seguimiento</p>
        </div>
        <Button
          onClick={handleCrear}
          disabled={creating}
          className="bg-blue-600 hover:bg-blue-700 text-white w-fit"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          {creating ? 'Creando...' : 'Nueva Pre-Nota'}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : prenotas.length === 0 ? (
        <div className="border rounded-xl p-8 bg-white dark:bg-zinc-900 shadow-sm text-center text-zinc-400">
          No tienes pre-notas de venta aún
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-12">
          {prenotas.map(prenota => (
            <div
              key={prenota.id}
              className="bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="font-bold text-base truncate">{prenota.titulo}</p>
                </div>
                <p className="text-xs text-zinc-400 mt-1">{formatFecha(prenota.created_at)}</p>
                {prenota.nombre_cliente && (
                  <p className="text-sm text-zinc-500 mt-2">{prenota.nombre_cliente}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => router.push(`/prenotas/${prenota.id}`)}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                </Button>
                {rol === 'admin' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                    onClick={() => handleEliminar(prenota.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
