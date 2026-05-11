'use client';
import { useState, useEffect, useCallback } from 'react';
import { nombreMes } from './sueldos-utils';
import { formatMonto } from '../pettycash/pettycash-utils';
import { toast } from 'sonner';
import { useNumericInput } from '@/hooks/useNumericInput';
import { Pencil } from 'lucide-react';

interface Movimiento {
  id: number;
  tipo: string;
  monto: string | number;
  descripcion: string | null;
  confirmado_at: string | null;
}

interface Usuario {
  id: number;
  nombre: string;
  rol: string;
}

const ANIOS = [2024, 2025, 2026, 2027];

export function SueldosAdminClient() {
  const hoy = new Date();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioId, setUsuarioId] = useState<number | ''>('');
  const [formMes, setFormMes] = useState(hoy.getMonth() + 1);
  const [formAnio, setFormAnio] = useState(hoy.getFullYear());
  const [tipo, setTipo] = useState<'sueldo' | 'adelanto' | 'quincena'>('sueldo');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [montoBase, setMontoBase] = useState('');
  const [saving, setSaving] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [totalDescuentos, setTotalDescuentos] = useState(0);
  const [sueldoRegistrado, setSueldoRegistrado] = useState<{ id: number; tipo: string; monto_base: number; monto_final: number; descripcion: string | null; pagado_at: string | null } | null>(null);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [editSueldoOpen, setEditSueldoOpen] = useState(false);
  const [editSueldoMonto, setEditSueldoMonto] = useState('');
  const [editSueldoDesc, setEditSueldoDesc] = useState('');
  const [editMovId, setEditMovId] = useState<number | null>(null);
  const [editMovMonto, setEditMovMonto] = useState('');
  const [editMovDesc, setEditMovDesc] = useState('');

  const montoBaseProps = useNumericInput(montoBase, setMontoBase);
  const montoProps = useNumericInput(monto, setMonto);
  const editSueldoMontoProps = useNumericInput(editSueldoMonto, setEditSueldoMonto);
  const editMovMontoProps = useNumericInput(editMovMonto, setEditMovMonto);
  const montoFinalCalc = Math.max(0, parseFloat(montoBase || '0') - totalDescuentos);

  useEffect(() => {
    fetch('/api/admin/usuarios')
      .then(r => r.json())
      .then(d => setUsuarios(d.data ?? []));
  }, []);

  const fetchMovimientos = useCallback(() => {
    if (!usuarioId) { setMovimientos([]); setTotalDescuentos(0); setSueldoRegistrado(null); return; }
    setLoadingMovs(true);
    fetch(`/api/sueldos/movimientos?usuario_id=${usuarioId}&mes=${formMes}&anio=${formAnio}`)
      .then(r => r.json())
      .then(d => { setMovimientos(d.movimientos ?? []); setTotalDescuentos(d.total_descuentos ?? 0); setSueldoRegistrado(d.sueldo ?? null); })
      .finally(() => setLoadingMovs(false));
  }, [usuarioId, formMes, formAnio]);

  useEffect(() => { fetchMovimientos(); }, [fetchMovimientos]);

  useEffect(() => {
    if (!usuarioId || tipo !== 'sueldo') { setMontoBase(''); return; }
    fetch(`/api/trabajadores/${usuarioId}/config`)
      .then(r => r.json())
      .then(d => { setMontoBase(d.monto_base ? String(Math.round(d.monto_base)) : ''); });
  }, [usuarioId, tipo]);

  const startEditSueldo = () => {
    if (!sueldoRegistrado) return;
    setEditSueldoMonto(String(Math.round(sueldoRegistrado.monto_final)));
    setEditSueldoDesc(sueldoRegistrado.descripcion ?? '');
    setEditSueldoOpen(true);
  };

  const saveSueldoEdit = async () => {
    if (!sueldoRegistrado) return;
    const res = await fetch(`/api/sueldos/${sueldoRegistrado.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto_final: parseFloat(editSueldoMonto),
        descripcion: editSueldoDesc.trim() || null,
      }),
    });
    if (res.ok) {
      toast.success('Actualizado');
      setEditSueldoOpen(false);
      fetchMovimientos();
    } else {
      const { error } = await res.json();
      toast.error(error ?? 'Error al actualizar');
    }
  };

  const deleteSueldo = async () => {
    if (!sueldoRegistrado) return;
    if (!confirm('¿Eliminar este registro?')) return;
    const res = await fetch(`/api/sueldos/${sueldoRegistrado.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Eliminado');
      setEditSueldoOpen(false);
      fetchMovimientos();
    } else {
      const { error } = await res.json();
      toast.error(error ?? 'Error al eliminar');
    }
  };

  const marcarPagado = async (id: number) => {
    await fetch(`/api/sueldos/${id}`, { method: 'PATCH' });
    setEditSueldoOpen(false);
    fetchMovimientos();
  };

  const startEditMov = (m: Movimiento) => {
    setEditMovId(m.id);
    setEditMovMonto(String(Math.round(parseFloat(String(m.monto)))));
    setEditMovDesc(m.descripcion ?? '');
  };

  const saveMovEdit = async () => {
    if (editMovId === null) return;
    const res = await fetch(`/api/sueldos/${editMovId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto_final: parseFloat(editMovMonto),
        descripcion: editMovDesc.trim() || null,
      }),
    });
    if (res.ok) {
      toast.success('Actualizado');
      setEditMovId(null);
      fetchMovimientos();
    } else {
      const { error } = await res.json();
      toast.error(error ?? 'Error al actualizar');
    }
  };

  const deleteMov = async () => {
    if (editMovId === null) return;
    if (!confirm('¿Eliminar este registro?')) return;
    const res = await fetch(`/api/sueldos/${editMovId}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Eliminado');
      setEditMovId(null);
      fetchMovimientos();
    } else {
      const { error } = await res.json();
      toast.error(error ?? 'Error al eliminar');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioId) return;
    if (tipo === 'sueldo' && !montoBase) return;
    if (tipo !== 'sueldo' && !monto) return;
    setSaving(true);
    try {
      const body = tipo === 'sueldo'
        ? { usuario_id: usuarioId, mes: formMes, anio: formAnio, tipo, monto_base: parseFloat(montoBase), monto_final: montoFinalCalc }
        : { usuario_id: usuarioId, mes: formMes, anio: formAnio, tipo, monto: parseFloat(monto), descripcion: descripcion.trim() || undefined };
      const res = await fetch('/api/sueldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(tipo === 'sueldo' ? 'Sueldo registrado' : 'Registrado');
        setMontoBase('');
        setMonto('');
        setDescripcion('');
        fetchMovimientos();
      } else {
        const { error } = await res.json();
        toast.error(error?.message ?? JSON.stringify(error) ?? 'Error al registrar');
      }
    } catch {
      toast.error('Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      <h1 className="text-3xl font-extrabold tracking-tight">Sueldos</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 border rounded-lg bg-white dark:bg-zinc-900">
        <select
          className="border rounded px-3 py-2 text-sm"
          value={tipo}
          onChange={e => setTipo(e.target.value as typeof tipo)}
        >
          <option value="sueldo">Sueldo</option>
          <option value="adelanto">Adelanto</option>
          <option value="quincena">Quincena</option>
        </select>
        <select
          className="border rounded px-3 py-2 text-sm col-span-2"
          value={usuarioId}
          onChange={e => setUsuarioId(e.target.value ? Number(e.target.value) : '')}
          required
        >
          <option value="">Seleccionar trabajador...</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
        <select className="border rounded px-3 py-2 text-sm" value={formMes} onChange={e => setFormMes(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{nombreMes(i + 1)}</option>
          ))}
        </select>
        <select className="border rounded px-3 py-2 text-sm" value={formAnio} onChange={e => setFormAnio(Number(e.target.value))}>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {tipo === 'sueldo' ? (
          <>
            <div className="border rounded px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
              <span className="text-zinc-400 text-xs whitespace-nowrap">Monto base</span>
              <input
                className="bg-transparent text-right text-green-600 font-semibold outline-none w-full"
                placeholder="0"
                type="number" min="0" step="1"
                required
                {...montoBaseProps}
                onBlur={(e) => {
                  montoBaseProps.onBlur(e);
                  if (usuarioId && montoBase) {
                    fetch(`/api/trabajadores/${usuarioId}/config`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ monto_base: Math.round(parseFloat(montoBase)) }),
                    });
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <div className="border rounded px-3 py-2 text-sm flex-1 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400 text-xs mr-2">A pagar</span>
                <span className="font-semibold text-red-600">
                  {formatMonto(montoFinalCalc)}
                </span>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? 'Registrando...' : 'Pagar Sueldo'}
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              className="border rounded px-3 py-2 text-sm"
              placeholder="Monto"
              type="number" min="0" step="1"
              required
              {...montoProps}
            />
            <input
              className="border rounded px-3 py-2 text-sm"
              placeholder="Descripción (opcional)"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Registrando...' : 'Registrar'}
            </button>
          </>
        )}
      </form>

      {usuarioId && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-500 uppercase flex justify-between">
            <span>Detalle del mes — {nombreMes(formMes)} {formAnio}</span>
            {totalDescuentos > 0 && <span className="text-red-600 text-base font-bold">−{formatMonto(totalDescuentos)}</span>}
          </div>
          {loadingMovs ? (
            <p className="px-4 py-3 text-sm text-zinc-400 animate-pulse">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-zinc-400 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Descripción</th>
                  <th className="px-4 py-2 text-right">Monto</th>
                  <th className="px-4 py-2 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {movimientos.map(m => (
                  <>
                  <tr key={m.id}>
                    <td className="px-4 py-2 capitalize">{m.tipo}</td>
                    <td className="px-4 py-2 text-zinc-500">{m.descripcion ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-red-600">−{formatMonto(parseFloat(String(m.monto)))}</td>
                    <td className="px-4 py-2 text-center">
                      {editMovId !== m.id && (
                        <button onClick={() => startEditMov(m)} className="text-xs p-1 rounded hover:bg-zinc-200">
                          <Pencil className="w-3 h-3 text-zinc-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {editMovId === m.id && (
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-400">Monto</label>
                            <input type="number" min="0" step="1"
                              className="border rounded px-2 py-1 w-28 text-sm"
                              {...editMovMontoProps}
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                            <label className="text-xs text-zinc-400">Descripción</label>
                            <input className="border rounded px-2 py-1 text-sm"
                              value={editMovDesc}
                              onChange={e => setEditMovDesc(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2 items-end">
                            <button onClick={saveMovEdit} className="text-xs px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Guardar</button>
                            <button onClick={deleteMov} className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200">Eliminar</button>
                            <button onClick={() => setEditMovId(null)} className="text-xs px-3 py-1.5 rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200">Cancelar</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                ))}
                {sueldoRegistrado && (
                  <>
                  <tr className="bg-emerald-50/60 dark:bg-emerald-900/10 font-medium">
                    <td className="px-4 py-2 capitalize">{sueldoRegistrado.tipo}</td>
                    <td className="px-4 py-2 text-zinc-500">Base: {formatMonto(sueldoRegistrado.monto_base)}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">{formatMonto(sueldoRegistrado.monto_final)}</td>
                    <td className="px-4 py-2 text-center">
                      {!editSueldoOpen && (
                        <button onClick={startEditSueldo} className="text-xs p-1 rounded hover:bg-zinc-200">
                          <Pencil className="w-3 h-3 text-zinc-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {editSueldoOpen && (
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-400">Monto final</label>
                            <input
                              type="number" min="0" step="1"
                              className="border rounded px-2 py-1 w-28 text-sm"
                              {...editSueldoMontoProps}
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                            <label className="text-xs text-zinc-400">Descripción</label>
                            <input
                              className="border rounded px-2 py-1 text-sm"
                              value={editSueldoDesc}
                              onChange={e => setEditSueldoDesc(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2 items-end">
                            <button onClick={saveSueldoEdit} className="text-xs px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Guardar</button>
                            {!sueldoRegistrado.pagado_at && (
                              <button onClick={() => marcarPagado(sueldoRegistrado.id)} className="text-xs px-3 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Marcar pagado</button>
                            )}
                            <button onClick={deleteSueldo} className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200">Eliminar</button>
                            <button onClick={() => setEditSueldoOpen(false)} className="text-xs px-3 py-1.5 rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200">Cancelar</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                )}
                {!sueldoRegistrado && movimientos.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-3 text-zinc-400 text-center">Sin movimientos este mes.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}
