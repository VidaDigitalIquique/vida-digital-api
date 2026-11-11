'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUSD } from '@/lib/utils';
import { validarPct, type InformeComisiones } from '@/lib/comisiones-utils';

const COLUMNAS = ['Vendedor', 'Notas facturadas', 'Total vendido USD', '% comisión', 'Comisión USD'];
const CAMPO = 'rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm';
const TH = 'whitespace-nowrap px-3 py-2 text-left font-medium text-zinc-500';
const TD = 'whitespace-nowrap px-3 py-2';
const leer = (r: Response) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)));

// La UI no recalcula: pinta filas y totales tal como los devuelve la API (S6 igual).
export function ComisionesPanel() {
  const [data, setData] = useState<InformeComisiones | null>(null);
  const [mes, setMes] = useState('');
  const [pct, setPct] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);
  const [avisoPct, setAvisoPct] = useState(false);
  const pedido = useRef(0);
  const guardandoRef = useRef(false);
  // EXP-A (S5): si el usuario esta editando el %, cambiar de mes no debe pisarlo.
  const pctServidor = useRef('');
  const pctSucio = useRef(false);

  // Coma o punto desde el teclado; la API recibe un numero.
  const normalizado = pct.trim().replace(',', '.');
  const pctNum = normalizado === '' ? null : validarPct(Number(normalizado));
  const errorPct = normalizado === ''
    ? 'Ingresa el porcentaje de comisión.'
    : pctNum === null
      ? 'Porcentaje inválido: usa un número entre 0 y 100 con hasta 2 decimales.'
      : '';

  const cargar = useCallback((elegido?: string) => {
    const id = ++pedido.current;
    setCargando(true);
    setError(false);
    setAvisoPct(false);
    const sufijo = elegido ? `?mes=${encodeURIComponent(elegido)}` : '';
    fetch(`/api/vendedores/comisiones${sufijo}`)
      .then(leer)
      .then((json: InformeComisiones) => {
        if (id !== pedido.current) return; // respuesta vieja
        const texto = json.comision_pct.toFixed(2);
        pctServidor.current = texto;
        setData(json);
        setMes(json.mes);
        if (!pctSucio.current) setPct(texto);
        setCargando(false);
      })
      .catch(() => {
        if (id !== pedido.current) return;
        setError(true);
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarMes = (valor: string) => {
    if (!valor) return;
    setMes(valor);
    cargar(valor);
  };

  const guardar = () => {
    if (pctNum === null || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    setAvisoPct(false);
    fetch('/api/vendedores/comisiones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, comision_pct: pctNum }),
    })
      .then(leer)
      .then((json: InformeComisiones) => {
        const texto = json.comision_pct.toFixed(2);
        pctServidor.current = texto;
        pctSucio.current = false;
        setData(json);
        setMes(json.mes);
        setPct(texto);
      })
      .catch(() => setAvisoPct(true))
      .finally(() => {
        guardandoRef.current = false;
        setGuardando(false);
      });
  };

  return (
    <section className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
      <h2 className="text-xl font-bold tracking-tight">Comisiones</h2>
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Mes
          <input aria-label="Mes" type="month" value={mes} onChange={(e) => cambiarMes(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          % de comisión
          <input aria-label="% de comisión" type="text" inputMode="decimal" value={pct} onChange={(e) => { pctSucio.current = e.target.value !== pctServidor.current; setPct(e.target.value); }} className={`w-28 ${CAMPO}`} />
        </label>
        <button type="button" onClick={guardar} disabled={pctNum === null || guardando || cargando} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">
          Guardar
        </button>
        {mes && (
          <a href={`/api/vendedores/comisiones?mes=${encodeURIComponent(mes)}&formato=xlsx`} className="rounded-md border px-3 py-1.5 text-sm">
            Exportar
          </a>
        )}
        {data && <span className="text-sm text-zinc-500">Informe de {data.mes_etiqueta}</span>}
      </div>

      {!cargando && !error && errorPct && <p className="text-xs text-amber-600">{errorPct}</p>}
      {avisoPct && <p className="text-xs text-amber-600">No se pudo guardar el porcentaje.</p>}
      {cargando && <p className="py-8 text-center text-zinc-400">Cargando...</p>}
      {!cargando && error && <p className="py-8 text-center text-red-600">No se pudieron cargar las comisiones.</p>}
      {!cargando && !error && data && (
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>{COLUMNAS.map((c) => <th key={c} className={TH}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {data.filas.map((f) => (
                <tr key={f.vendedor} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className={TD}>{f.vendedor}</td>
                  <td className={TD}>{f.notas}</td>
                  <td className={TD}>{formatUSD(f.total_usd)}</td>
                  <td className={TD}>{f.comision_pct.toFixed(2)} %</td>
                  <td className={TD}>{formatUSD(f.comision_usd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50 dark:bg-zinc-900">
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <th className={TH}>Total</th>
                <th className={TH}>{data.totales.notas}</th>
                <th className={TH}>{formatUSD(data.totales.total_usd)}</th>
                <th className={TH}>{data.comision_pct.toFixed(2)} %</th>
                <th className={TH}>{formatUSD(data.totales.comision_usd)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
