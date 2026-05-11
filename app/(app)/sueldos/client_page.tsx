'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { formatMesAnio, nombreMes } from './sueldos-utils';
import { formatMonto } from '../pettycash/pettycash-utils';
import { toast } from 'sonner';
import { useNumericInput } from '@/hooks/useNumericInput';

interface Movimiento {
  id: number;
  tipo: string;
  monto: string | number;
  descripcion: string | null;
  confirmado_at: string | null;
}

interface Sueldo {
  id: number;
  usuario_id: number;
  trabajador_nombre: string;
  mes: number;
  anio: number;
  tipo: string;
  monto_base: number;
  monto_final: number;
  descripcion: string | null;
  pagado_at: string | null;
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
  const [mesFiltro, setMesFiltro] = useState(hoy.getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(hoy.getFullYear());
  const [sueldos, setSueldos] = useState<Sueldo[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [sueldoRegistrado, setSueldoRegistrado] = useState<{ monto_base: number; monto_final: number; pagado_at: string | null } | null>(null);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMontoFinal, setEditMontoFinal] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

  const montoBaseProps = useNumericInput(montoBase, setMontoBase);
  const montoProps = useNumericInput(monto, setMonto);
  const editMontoFinalProps = useNumericInput(editMontoFinal, setEditMontoFinal);
  const montoFinalCalc = Math.max(0, parseFloat(montoBase || '0') - totalDescuentos);

  const filteredSueldos = usuarioId ? sueldos.filter(s => s.usuario_id === usuarioId) : [];

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

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/sueldos?mes=${mesFiltro}&anio=${anioFiltro}`);
    const data = await res.json();
    setSueldos(data.sueldos ?? []);
    setLoading(false);
  }, [mesFiltro, anioFiltro]);

  useEffect(() => { load(); }, [load]);

  const marcarPagado = async (id: number) => {
    await fetch(`/api/sueldos/${id}`, { method: 'PATCH' });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const res = await fetch(`/api/sueldos/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Eliminado'); load(); fetchMovimientos(); }
    else { const { error } = await res.json(); toast.error(error ?? 'Error al eliminar'); }
  };

  const handleEdit = (s: Sueldo) => {
    setEditingId(s.id);
    setEditMontoFinal(String(Math.round(s.monto_final)));
    setEditDescripcion(s.descripcion ?? '');
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    const res = await fetch(`/api/sueldos/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto_final: parseFloat(editMontoFinal), descripcion: editDescripcion.trim() || null }),
    });
    if (res.ok) { toast.success('Actualizado'); setEditingId(null); load(); }
    else { const { error } = await res.json(); toast.error(error ?? 'Error al actualizar'); }
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
        load();
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
            <input
              className="border rounded px-3 py-2 text-sm text-green-600 font-semibold"
              placeholder="Monto base"
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
            {totalDescuentos > 0 && <span className="text-red-600">−{formatMonto(totalDescuentos)}</span>}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 capitalize">{m.tipo}</td>
                    <td className="px-4 py-2 text-zinc-500">{m.descripcion ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-red-600">−{formatMonto(parseFloat(String(m.monto)))}</td>
                  </tr>
                ))}
                {sueldoRegistrado && (
                  <tr className="bg-emerald-50/60 dark:bg-emerald-900/10 font-medium">
                    <td className="px-4 py-2">Pago sueldo</td>
                    <td className="px-4 py-2 text-zinc-500">Base: {formatMonto(sueldoRegistrado.monto_base)}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">{formatMonto(sueldoRegistrado.monto_final)}</td>
                  </tr>
                )}
                {!sueldoRegistrado && movimientos.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-3 text-zinc-400 text-center">Sin movimientos este mes.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="flex gap-3 items-center">
        <span className="text-sm text-zinc-500">Filtrar:</span>
        <select className="border rounded px-3 py-2 text-sm" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{nombreMes(i + 1)}</option>
          ))}
        </select>
        <select className="border rounded px-3 py-2 text-sm" value={anioFiltro} onChange={e => setAnioFiltro(Number(e.target.value))}>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-zinc-400 text-sm">Cargando...</p>
      ) : filteredSueldos.length === 0 ? (
        <p className="text-zinc-400 text-sm">Sin sueldos para {formatMesAnio(mesFiltro, anioFiltro)}.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Trabajador</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Final</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Confirmación</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredSueldos.map(s => (
                <React.Fragment key={s.id}>
                <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-medium">{s.trabajador_nombre}</td>
                  <td className="px-4 py-3 capitalize text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${
                      s.tipo === 'sueldo' ? 'bg-blue-100 text-blue-700' :
                      s.tipo === 'adelanto' ? 'bg-amber-100 text-amber-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>{s.tipo}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatMesAnio(s.mes, s.anio)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMonto(s.monto_final)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.pagado_at
                      ? <span className="text-emerald-600 text-xs font-semibold">Pagado</span>
                      : <span className="text-amber-500 text-xs font-semibold">Pendiente</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.confirmado_at
                      ? <span className="text-emerald-600 text-xs">
                          {new Date(s.confirmado_at).toLocaleDateString('es-CL')}
                        </span>
                      : <span className="text-zinc-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId !== s.id && (
                      <button onClick={() => handleEdit(s)} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Editar</button>
                    )}
                  </td>
                </tr>
                {editingId === s.id && (
                  <tr key={`edit-${s.id}`} className="bg-zinc-50 dark:bg-zinc-900/50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-zinc-400">Monto final</label>
                          <input
                            type="number" min="0" step="1"
                            className="border rounded px-2 py-1 w-28 text-sm"
                            {...editMontoFinalProps}
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                          <label className="text-xs text-zinc-400">Descripción</label>
                          <input
                            className="border rounded px-2 py-1 text-sm"
                            placeholder="Descripción"
                            value={editDescripcion}
                            onChange={e => setEditDescripcion(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 items-end">
                          <button onClick={handleSaveEdit} className="text-xs px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Guardar</button>
                          {!s.pagado_at && (
                            <button onClick={() => { marcarPagado(s.id); setEditingId(null); }} className="text-xs px-3 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Marcar pagado</button>
                          )}
                          <button onClick={() => handleDelete(s.id)} className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200">Eliminar</button>
                          <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200">Cancelar</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
