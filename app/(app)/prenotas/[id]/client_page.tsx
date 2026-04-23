'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function PrenotaItemsTable({
  items,
  onEliminar,
}: {
  items: any[];
  onEliminar: (itemId: number) => void;
}) {
  return (
    <div className="border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Código</th>
              <th className="text-left px-4 py-3 font-medium">Descripción</th>
              <th className="text-left px-4 py-3 font-medium">Empresa</th>
              <th className="text-right px-4 py-3 font-medium">Cajas</th>
              <th className="text-right px-4 py-3 font-medium">Unidades</th>
              <th className="text-right px-4 py-3 font-medium">Precio</th>
              <th className="text-right px-4 py-3 font-medium">Stock</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-border align-top">
                <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">{item.codigo}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{item.descripcion}</div>
                  {Number(item.unidades) > Number(item.saldo_zofri ?? 0) && (
                    <div className="text-xs text-red-500 mt-1">⚠ Supera stock disponible</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge className={item.empresa_id === 1 ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}>
                    {item.empresa_id === 1 ? 'SANJH' : 'VIDA DIGITAL'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">{item.cajas}</td>
                <td className="px-4 py-3 text-right">{item.unidades}</td>
                <td className="px-4 py-3 text-right">${Number(item.precio).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{item.saldo_zofri ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                    onClick={() => onEliminar(item.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PrenotaDetallePage({ session, params }: { session: any; params: { id: string } }) {
  void session;
  const router = useRouter();
  const id = params.id;

  const [prenota, setPrenota] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchCliente, setSearchCliente] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<any[]>([]);

  const fetchPrenota = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prenotas/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPrenota(data);
      } else {
        toast.error('No se pudo cargar la pre-nota');
      }
    } catch {
      toast.error('No se pudo cargar la pre-nota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrenota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchCliente), 400);
    return () => clearTimeout(timer);
  }, [searchCliente]);

  useEffect(() => {
    async function buscarClientes() {
      if (debouncedSearch.trim().length < 2) {
        setClienteResults([]);
        return;
      }

      try {
        const res = await fetch(`/api/ventas/clientes?q=${encodeURIComponent(debouncedSearch)}&empresaSlug=vida`);
        if (res.ok) {
          const { data } = await res.json();
          setClienteResults(data || []);
        } else {
          setClienteResults([]);
        }
      } catch {
        setClienteResults([]);
      }
    }

    buscarClientes();
  }, [debouncedSearch]);

  const asignarCliente = async (c: any) => {
    try {
      await fetch(`/api/prenotas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kcodclie: Number(c.kcodclie), nombre_cliente: c.nombress }),
      });
      setSearchCliente('');
      setClienteResults([]);
      await fetchPrenota();
    } catch {
      toast.error('No se pudo asignar cliente');
    }
  };

  const quitarCliente = async () => {
    try {
      await fetch(`/api/prenotas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kcodclie: null, nombre_cliente: null }),
      });
      await fetchPrenota();
    } catch {
      toast.error('No se pudo quitar cliente');
    }
  };

  const eliminarItem = async (itemId: number) => {
    try {
      await fetch(`/api/prenotas/${id}/items/${itemId}`, { method: 'DELETE' });
      await fetchPrenota();
    } catch {
      toast.error('No se pudo eliminar item');
    }
  };

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      <div className="flex flex-col gap-3">
        <button
          onClick={() => router.push('/prenotas')}
          className="text-sm text-zinc-500 hover:text-zinc-700 w-fit"
        >
          ← Volver
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{prenota?.titulo || 'Pre-Nota'}</h1>
          </div>
          <Button disabled>Exportar Excel</Button>
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white dark:bg-zinc-900 shadow-sm flex flex-col gap-4">
        <h2 className="font-semibold text-base">Cliente</h2>
        {prenota?.nombre_cliente ? (
          <div className="flex items-center gap-3">
            <div className="font-medium">Cliente: {prenota.nombre_cliente}</div>
            <button onClick={quitarCliente} className="text-sm text-red-500 hover:text-red-700">✕</button>
          </div>
        ) : (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Buscar cliente..."
                value={searchCliente}
                onChange={e => setSearchCliente(e.target.value)}
                className="pl-9"
              />
            </div>
            {clienteResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {clienteResults.map(c => (
                  <button
                    key={c.kcodclie}
                    onClick={() => asignarCliente(c)}
                    className="text-left p-3 rounded-lg border border-border hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {c.nombress}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : prenota?.items?.length > 0 ? (
        <PrenotaItemsTable items={prenota.items} onEliminar={eliminarItem} />
      ) : (
        <p className="text-zinc-400">No hay productos en esta pre-nota aún</p>
      )}
    </div>
  );
}
