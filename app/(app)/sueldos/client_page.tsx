'use client';
import { useState, useEffect, useCallback } from 'react';
import { formatMesAnio, nombreMes } from './sueldos-utils';
import { formatMonto } from '../pettycash/pettycash-utils';

interface Sueldo {
  id: number;
  trabajador_nombre: string;
  mes: number;
  anio: number;
  monto_base: number;
  monto_final: number;
  pagado_at: string | null;
}

const ANIOS = [2024, 2025, 2026, 2027];

export function SueldosClient() {
  const hoy = new Date();
  const [mesFiltro, setMesFiltro] = useState(hoy.getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(hoy.getFullYear());
  const [sueldos, setSueldos] = useState<Sueldo[]>([]);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [formMes, setFormMes] = useState(hoy.getMonth() + 1);
  const [formAnio, setFormAnio] = useState(hoy.getFullYear());
  const [montoBase, setMontoBase] = useState('');
  const [montoFinal, setMontoFinal] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/sueldos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trabajador_nombre: nombre,
        mes: formMes,
        anio: formAnio,
        monto_base: parseFloat(montoBase),
        monto_final: parseFloat(montoFinal),
      }),
    });
    setSaving(false);
    setNombre('');
    setMontoBase('');
    setMontoFinal('');
    load();
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      <h1 className="text-3xl font-extrabold tracking-tight">Sueldos</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 border rounded-lg bg-white dark:bg-zinc-900">
        <input
          className="border rounded px-3 py-2 text-sm col-span-2"
          placeholder="Nombre trabajador"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
        />
        <select className="border rounded px-3 py-2 text-sm" value={formMes} onChange={e => setFormMes(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{nombreMes(i + 1)}</option>
          ))}
        </select>
        <select className="border rounded px-3 py-2 text-sm" value={formAnio} onChange={e => setFormAnio(Number(e.target.value))}>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          className="border rounded px-3 py-2 text-sm"
          placeholder="Monto base"
          type="number" min="0" step="1"
          value={montoBase}
          onChange={e => setMontoBase(e.target.value)}
          required
        />
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 text-sm flex-1"
            placeholder="Monto final"
            type="number" min="0" step="1"
            value={montoFinal}
            onChange={e => setMontoFinal(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? '...' : 'Agregar'}
          </button>
        </div>
      </form>

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
      ) : sueldos.length === 0 ? (
        <p className="text-zinc-400 text-sm">Sin sueldos para {formatMesAnio(mesFiltro, anioFiltro)}.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Trabajador</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Base</th>
                <th className="px-4 py-3 text-right">Final</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sueldos.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-medium">{s.trabajador_nombre}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatMesAnio(s.mes, s.anio)}</td>
                  <td className="px-4 py-3 text-right">{formatMonto(s.monto_base)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMonto(s.monto_final)}</td>
                  <td className="px-4 py-3 text-center">
                    {s.pagado_at
                      ? <span className="text-emerald-600 text-xs font-semibold">Pagado</span>
                      : <span className="text-amber-500 text-xs font-semibold">Pendiente</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!s.pagado_at && (
                      <button
                        onClick={() => marcarPagado(s.id)}
                        className="text-xs px-3 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      >
                        Marcar pagado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
