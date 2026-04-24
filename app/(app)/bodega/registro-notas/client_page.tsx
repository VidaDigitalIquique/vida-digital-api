'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Trash2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type Registro = {
  id: number;
  folio: string;
  empresa_id: number;
  usuario_id: number;
  usuario_nombre: string;
  observacion: string | null;
  created_at: string;
};

export function RegistroNotasPage({ session }: { session: any }) {
  const rol = (session?.user as any)?.rol as string;
  const isAdmin = rol === 'admin';

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroFolio, setFiltroFolio] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [debouncedFolio, setDebouncedFolio] = useState('');

  const [folio, setFolio] = useState('');
  const [empresaId, setEmpresaId] = useState<number>(2);
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFolio(filtroFolio), 400);
    return () => clearTimeout(t);
  }, [filtroFolio]);

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedFolio) params.set('folio', debouncedFolio);
      if (filtroFecha) params.set('fecha', filtroFecha);
      const res = await fetch(`/api/bodega/registro-notas?${params.toString()}`);
      if (res.ok) {
        const { data } = await res.json();
        setRegistros(data || []);
      }
    } catch {
      toast.error('Error cargando registros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFolio, filtroFecha]);

  const handleRegistrar = async () => {
    if (!folio.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/bodega/registro-notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folio: folio.trim(), empresa_id: empresaId, observacion: observacion.trim() || null }),
      });
      if (res.ok) {
        toast.success('Nota registrada');
        setFolio('');
        setObservacion('');
        await fetchRegistros();
      } else {
        const { error } = await res.json();
        toast.error(error || 'Error al registrar');
      }
    } catch {
      toast.error('Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      const res = await fetch(`/api/bodega/registro-notas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRegistros(prev => prev.filter(r => r.id !== id));
        toast.success('Registro eliminado');
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const empresaBadge = (empresaId: number) =>
    empresaId === 1
      ? { label: 'SANJH', color: 'bg-amber-100 text-amber-700' }
      : { label: 'VIDA DIGITAL', color: 'bg-teal-100 text-teal-700' };

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Registro de Notas</h1>
          <p className="text-zinc-500 mt-1">Control de custodia de notas de venta hacia bodega</p>
        </div>
      </div>

      {/* Formulario de registro */}
      <div className="border rounded-xl p-5 bg-white dark:bg-zinc-900 shadow-sm flex flex-col gap-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-blue-500" />
          Registrar nota
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">N° Nota *</label>
            <Input
              value={folio}
              onChange={e => setFolio(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="Ej: 001234"
              className="mt-1"
              onKeyDown={e => { if (e.key === 'Enter') handleRegistrar(); }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Empresa</label>
            <select
              value={empresaId}
              onChange={e => setEmpresaId(Number(e.target.value))}
              className="mt-1 w-full text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200"
            >
              <option value={2}>VIDA DIGITAL</option>
              <option value={1}>SANJH</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Observación</label>
            <Input
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Opcional..."
              className="mt-1"
              onKeyDown={e => { if (e.key === 'Enter') handleRegistrar(); }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleRegistrar}
            disabled={!folio.trim() || saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {saving ? 'Registrando...' : 'Registrar'}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Filtrar por N° nota..."
          value={filtroFolio}
          onChange={e => setFiltroFolio(e.target.value)}
          className="max-w-xs"
        />
        <input
          type="date"
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
          className="text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200"
        />
        {(filtroFolio || filtroFecha) && (
          <Button variant="outline" className="text-xs" onClick={() => { setFiltroFolio(''); setFiltroFecha(''); }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : registros.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          No hay registros aún.
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">N° Nota</th>
                  <th className="text-left px-4 py-3 font-medium">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Hora</th>
                  <th className="text-left px-4 py-3 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium">Observación</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {registros.map(r => {
                  const badge = empresaBadge(r.empresa_id);
                  const dt = parseISO(r.created_at);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-700 dark:text-zinc-200">{r.folio}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${badge.color}`}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {format(dt, 'dd MMM yyyy', { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {format(dt, 'HH:mm', { locale: es })}
                      </td>
                      <td className="px-4 py-3 font-medium">{r.usuario_nombre}</td>
                      <td className="px-4 py-3 text-zinc-500 italic">{r.observacion || '—'}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => handleEliminar(r.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
