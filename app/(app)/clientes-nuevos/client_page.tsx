'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AgregarADeseadosModal } from '@/components/AgregarADeseadosModal';
import { inferPaisDesdePhone } from '@/lib/phone-utils';
import { toast } from 'sonner';
import { Search, PlusCircle, Trash2, ExternalLink, Pencil, X, Check } from 'lucide-react';
import flags from '@/config/feature-flags.json';

type ClienteDeseado = {
  id: number;
  nombre: string;
  whatsapp: string | null;
  pais: string | null;
  ciudad: string | null;
  notas: string | null;
  total_deseados: number;
};

type FormState = {
  nombre: string;
  whatsapp: string;
  pais: string;
  ciudad: string;
  notas: string;
};

const FORM_EMPTY: FormState = { nombre: '', whatsapp: '', pais: '', ciudad: '', notas: '' };

export function ClientesNuevosPage({ session }: { session: any }) {
  const enabled = (flags as any)['clientes-nuevos-visible'];
  const isAdmin = (session?.user as any)?.rol === 'admin';
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clientes, setClientes] = useState<ClienteDeseado[]>([]);
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [sugerenciaActiva, setSugerenciaActiva] = useState<any | null>(null);
  const [deseadoCliente, setDeseadoCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(FORM_EMPTY);

  async function fetchSugerencias() {
    try {
      const res = await fetch('/api/conversion-sugerencias');
      if (res.ok) {
        const { data } = await res.json();
        setSugerencias(data || []);
      }
    } catch {
      toast.error('Error cargando sugerencias');
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchSugerencias();
  }, []);

  useEffect(() => {
    async function fetchClientes() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch.trim().length >= 2) params.set('search', debouncedSearch.trim());
        const res = await fetch(`/api/clientes-deseados?${params.toString()}`);
        if (res.ok) {
          const { data } = await res.json();
          setClientes(data || []);
        }
      } catch {
        toast.error('Error cargando clientes');
      } finally {
        setLoading(false);
      }
    }
    fetchClientes();
  }, [debouncedSearch]);

  if (!enabled) return null;

  async function refetch() {
    const res = await fetch('/api/clientes-deseados');
    if (res.ok) {
      const { data } = await res.json();
      setClientes(data || []);
    }
  }

  const handleAccion = async (id: number, accion: 'aprobar' | 'rechazar') => {
    try {
      const res = await fetch(`/api/conversion-sugerencias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (res.ok) {
        toast.success(accion === 'aprobar' ? 'Conversión aprobada' : 'Sugerencia rechazada');
        setSugerenciaActiva(null);
        await fetchSugerencias();
        await refetch();
      } else {
        const { error } = await res.json();
        toast.error(error || 'Error procesando sugerencia');
      }
    } catch {
      toast.error('Error procesando sugerencia');
    }
  };

  const handleCrear = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/clientes-deseados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          whatsapp: form.whatsapp.trim() || undefined,
          pais: form.pais.trim() || undefined,
          ciudad: form.ciudad.trim() || undefined,
          notas: form.notas.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Cliente creado');
        setForm(FORM_EMPTY);
        setShowForm(false);
        await refetch();
      } else {
        const { error } = await res.json();
        toast.error(error || 'Error al crear');
      }
    } catch {
      toast.error('Error al crear cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleCrearYAgregarDeseado = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/clientes-deseados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          whatsapp: form.whatsapp.trim() || undefined,
          pais: form.pais.trim() || undefined,
          ciudad: form.ciudad.trim() || undefined,
          notas: form.notas.trim() || undefined,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        setForm(FORM_EMPTY);
        setShowForm(false);
        await refetch();
        if (body?.data?.id) {
          setDeseadoCliente({ id: String(body.data.id), nombre: body.data.nombre || form.nombre.trim() });
        }
      } else {
        const { error } = await res.json();
        toast.error(error || 'Error al crear');
      }
    } catch {
      toast.error('Error al crear cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = async (id: number) => {
    try {
      const res = await fetch(`/api/clientes-deseados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editForm.nombre.trim(),
          whatsapp: editForm.whatsapp.trim() || undefined,
          pais: editForm.pais.trim() || undefined,
          ciudad: editForm.ciudad.trim() || undefined,
          notas: editForm.notas.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Cliente actualizado');
        setEditingId(null);
        await refetch();
      } else {
        const { error } = await res.json();
        toast.error(error || 'Error al actualizar');
      }
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este cliente? Se eliminará solo si no tiene productos deseados.')) return;
    try {
      const res = await fetch(`/api/clientes-deseados/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setClientes(prev => prev.filter(c => c.id !== id));
        toast.success('Cliente eliminado');
      } else {
        const { error } = await res.json();
        toast.error(error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Clientes Nuevos</h1>
          <p className="text-zinc-500 mt-1">Clientes externos sin cuenta en WinFac</p>
        </div>
        <Button
          onClick={() => { setShowForm(v => !v); setForm(FORM_EMPTY); }}
          className="bg-blue-600 hover:bg-blue-700 text-white w-fit"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Formulario nuevo cliente */}
      {showForm && (
        <div className="border rounded-xl p-5 bg-white dark:bg-zinc-900 shadow-sm flex flex-col gap-4">
          <h2 className="font-semibold text-base">Agregar cliente nuevo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Nombre *</label>
              <Input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">WhatsApp</label>
              <Input
                value={form.whatsapp}
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => {
                    const pais = !f.pais.trim() ? (inferPaisDesdePhone(val) ?? f.pais) : f.pais;
                    return { ...f, whatsapp: val, pais };
                  });
                }}
                placeholder="+56912345678"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">País</label>
              <Input
                value={form.pais}
                onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
                placeholder="Ej: Chile"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ciudad</label>
              <Input
                value={form.ciudad}
                onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                placeholder="Ej: Iquique"
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Notas</label>
              <Input
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end flex-wrap">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              variant="outline"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
              onClick={handleCrearYAgregarDeseado}
              disabled={!form.nombre.trim() || saving}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Crear y agregar deseado'}
            </Button>
            <Button onClick={handleCrear} disabled={!form.nombre.trim() || saving}>
              {saving ? 'Guardando...' : 'Crear'}
            </Button>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {sugerencias.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 font-medium">
            {sugerencias.length} sugerencia{sugerencias.length > 1 ? 's' : ''} de conversión pendiente{sugerencias.length > 1 ? 's' : ''}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {sugerencias.map(s => (
              <button
                key={s.id}
                onClick={() => setSugerenciaActiva(s)}
                className="text-left text-sm text-amber-700 hover:text-amber-900 underline"
              >
                {s.nombre_winfac} → {s.nombre_lead} ({Math.round(s.score * 100)}% confianza)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          No hay clientes nuevos registrados.
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-12">
          {clientes.map(cliente => (
            <div
              key={cliente.id}
              className="bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm flex flex-col gap-3"
            >
              {editingId === cliente.id ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Nombre *</label>
                      <Input
                        value={editForm.nombre}
                        onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">WhatsApp</label>
                      <Input
                        value={editForm.whatsapp}
                        onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">País</label>
                      <Input
                        value={editForm.pais}
                        onChange={e => setEditForm(f => ({ ...f, pais: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ciudad</label>
                      <Input
                        value={editForm.ciudad}
                        onChange={e => setEditForm(f => ({ ...f, ciudad: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Notas</label>
                      <Input
                        value={editForm.notas}
                        onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={() => handleEditar(cliente.id)} disabled={!editForm.nombre.trim()}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-base">{cliente.nombre}</p>
                      {(cliente.ciudad || cliente.pais) && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {[cliente.ciudad, cliente.pais].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {cliente.whatsapp && (
                        <p className="text-xs text-zinc-500 mt-0.5">{cliente.whatsapp}</p>
                      )}
                      {cliente.notas && (
                        <p className="text-xs text-zinc-400 italic mt-0.5">{cliente.notas}</p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0">
                      {cliente.total_deseados} {cliente.total_deseados === 1 ? 'deseo' : 'deseos'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setEditingId(cliente.id);
                        setEditForm({
                          nombre: cliente.nombre,
                          whatsapp: cliente.whatsapp || '',
                          pais: cliente.pais || '',
                          ciudad: cliente.ciudad || '',
                          notas: cliente.notas || '',
                        });
                      }}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                      onClick={() => setDeseadoCliente({ id: String(cliente.id), nombre: cliente.nombre })}
                    >
                      <PlusCircle className="w-3 h-3 mr-1" /> Agregar Deseado
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20"
                      onClick={() => router.push(`/deseados?cliente_deseado_id=${cliente.id}`)}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> Ver Deseados
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                        onClick={() => handleEliminar(cliente.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {sugerenciaActiva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full mx-4 flex flex-col gap-4">
            <h2 className="text-lg font-bold">Sugerencia de conversión</h2>
            <p><span className="font-medium">Cliente WinFac:</span> {sugerenciaActiva.nombre_winfac}</p>
            <p><span className="font-medium">Lead en agenda:</span> {sugerenciaActiva.nombre_lead}</p>
            {sugerenciaActiva.whatsapp_lead && <p><span className="font-medium">WhatsApp:</span> {sugerenciaActiva.whatsapp_lead}</p>}
            <p><span className="font-medium">Confianza:</span> {Math.round(sugerenciaActiva.score * 100)}%</p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => handleAccion(sugerenciaActiva.id, 'aprobar')}
                className="flex-1 bg-green-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-green-700"
              >
                Aprobar conversión
              </button>
              <button
                onClick={() => handleAccion(sugerenciaActiva.id, 'rechazar')}
                className="flex-1 bg-red-100 text-red-700 rounded-lg px-4 py-2 font-medium hover:bg-red-200"
              >
                Rechazar
              </button>
              <button
                onClick={() => setSugerenciaActiva(null)}
                className="px-4 py-2 text-zinc-500 hover:text-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {deseadoCliente && (
        <AgregarADeseadosModal
          open={deseadoCliente !== null}
          onOpenChange={open => { if (!open) setDeseadoCliente(null); }}
          codigo=""
          descripcion=""
          esChina={false}
          clientePreseleccionado={deseadoCliente}
        />
      )}
    </div>
  );
}
