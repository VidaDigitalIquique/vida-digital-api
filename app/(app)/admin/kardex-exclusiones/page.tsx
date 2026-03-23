'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

export default function KardexExclusionesPage() {
  const [exclusiones, setExclusiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPatron, setNewPatron] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmpresaId, setNewEmpresaId] = useState(1);
  const [saving, setSaving] = useState(false);

  const fetchExclusiones = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/kardex-exclusiones');
    if (res.ok) setExclusiones(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchExclusiones(); }, []);

  const handleAdd = async () => {
    if (!newPatron.trim()) return toast.error('El patrón no puede estar vacío');
    setSaving(true);
    const res = await fetch('/api/admin/kardex-exclusiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id: newEmpresaId, patron_nombre: newPatron, descripcion: newDesc }),
    });
    if (res.ok) {
      toast.success('Cliente excluido agregado');
      setNewPatron(''); setNewDesc('');
      fetchExclusiones();
    } else toast.error('Error al agregar');
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta exclusión?')) return;
    const res = await fetch('/api/admin/kardex-exclusiones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { toast.success('Eliminado'); fetchExclusiones(); }
    else toast.error('Error al eliminar');
  };

  const handleToggle = async (id: number, activo: boolean) => {
    const res = await fetch('/api/admin/kardex-exclusiones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: !activo }),
    });
    if (res.ok) { fetchExclusiones(); }
    else toast.error('Error al actualizar');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Clientes Excluidos del Kardex</h1>
        <p className="text-sm text-zinc-500 mt-1">Los precios de estos clientes no se consideran al calcular mín, máx y precio medio.</p>
      </div>

      {/* Add new */}
      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">Agregar exclusión</h2>
        <div className="flex gap-2">
          <select
            value={newEmpresaId}
            onChange={e => setNewEmpresaId(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-background"
          >
            <option value={1}>SANJH</option>
            <option value={2}>VIDA DIGITAL</option>
          </select>
          <Input value={newPatron} onChange={e => setNewPatron(e.target.value)} placeholder="Patrón nombre (ej: ANIL)" className="flex-1" />
        </div>
        <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción opcional" />
        <Button onClick={handleAdd} disabled={saving} className="w-full">
          <Plus className="w-4 h-4 mr-2" /> Agregar
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-zinc-400">Cargando...</div>
        ) : exclusiones.length === 0 ? (
          <div className="text-sm text-zinc-400 italic">No hay exclusiones configuradas.</div>
        ) : exclusiones.map(exc => (
          <div key={exc.id} className="flex items-center gap-3 border rounded-xl p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm">{exc.patron_nombre}</span>
                <Badge variant="outline" className="text-xs">{exc.empresa_nombre}</Badge>
                {!exc.activo && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
              </div>
              {exc.descripcion && <p className="text-xs text-zinc-400 mt-0.5">{exc.descripcion}</p>}
            </div>
            <button onClick={() => handleToggle(exc.id, exc.activo)} className="text-zinc-400 hover:text-zinc-700">
              {exc.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
            <button onClick={() => handleDelete(exc.id)} className="text-zinc-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
