'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatMonto, saldoColor } from './pettycash-utils';

type Movimiento = {
  id: number;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  monto: number;
  creado_por: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function PettycashClient() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesde, setFiltroDesde] = useState(firstDayOfMonth);
  const [filtroHasta, setFiltroHasta] = useState(lastDayOfMonth);

  // Formulario
  const [formTipo, setFormTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [formConcepto, setFormConcepto] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formFecha, setFormFecha] = useState(today());

  const fetchMovimientos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroDesde) params.set('desde', filtroDesde);
      if (filtroHasta) params.set('hasta', filtroHasta);
      const res = await fetch(`/api/pettycash?${params}`);
      if (res.ok) {
        const { data, saldo: s } = await res.json();
        setMovimientos(data);
        setSaldo(s);
      }
    } catch {
      toast.error('Error cargando movimientos');
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, filtroDesde, filtroHasta]);

  useEffect(() => { fetchMovimientos(); }, [fetchMovimientos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(formMonto);
    if (!formConcepto.trim() || !monto || monto <= 0) {
      toast.error('Completá todos los campos correctamente');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/pettycash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: formTipo, concepto: formConcepto.trim(), monto, fecha: formFecha }),
      });
      if (res.ok) {
        toast.success('Movimiento registrado');
        setFormConcepto('');
        setFormMonto('');
        setFormFecha(today());
        fetchMovimientos();
      } else {
        const { error } = await res.json();
        toast.error(error?.message ?? 'Error al guardar');
      }
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      <h1 className="text-3xl font-extrabold tracking-tight">Pettycash</h1>

      {/* Saldo */}
      <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm flex flex-col gap-1">
        <p className="text-sm text-zinc-500">Saldo actual</p>
        <p className={`text-4xl font-bold ${saldoColor(saldo)}`}>{formatMonto(saldo)}</p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Nuevo movimiento</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={formTipo}
            onChange={e => setFormTipo(e.target.value as 'ingreso' | 'egreso')}
            className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-800"
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Gasto</option>
          </select>
          <Input
            placeholder="Concepto"
            value={formConcepto}
            onChange={e => setFormConcepto(e.target.value)}
            className="flex-1 min-w-[180px]"
          />
          <Input
            type="number"
            placeholder="Monto"
            min={0.01}
            step={0.01}
            value={formMonto}
            onChange={e => setFormMonto(e.target.value)}
            className="w-36"
          />
          <Input
            type="date"
            value={formFecha}
            onChange={e => setFormFecha(e.target.value)}
            className="w-40"
          />
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? 'Guardando...' : 'Agregar'}
          </Button>
        </div>
      </form>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-800"
        >
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Gastos</option>
        </select>
        <Input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="w-40" placeholder="Desde" />
        <Input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} className="w-40" placeholder="Hasta" />
        <Button variant="outline" onClick={() => { setFiltroTipo(''); setFiltroDesde(firstDayOfMonth()); setFiltroHasta(lastDayOfMonth()); }}>
          Limpiar
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">Cargando...</div>
      ) : movimientos.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center text-zinc-400 text-sm">
          No hay movimientos registrados.
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Concepto</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {movimientos.map(m => (
                <tr key={m.id} className={`transition-colors ${m.tipo === 'ingreso' ? 'bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20' : 'bg-red-50/60 hover:bg-red-100/60 dark:bg-red-900/10 dark:hover:bg-red-900/20'}`}>
                  <td className="px-4 py-3 text-zinc-500">{m.fecha}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.tipo === 'ingreso'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {m.tipo === 'egreso' ? 'gasto' : m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">{m.concepto}</td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {m.tipo === 'egreso' ? '-' : ''}{formatMonto(parseFloat(String(m.monto)))}
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
