'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUSD } from '@/lib/utils';
import type { Agrupacion, EstadoGanancia, InformeGanancia } from '@/lib/vendedores-ganancia-tipos';

const GRUPOS: { valor: Agrupacion; texto: string }[] = [
  { valor: 'dia', texto: 'Día' },
  { valor: 'semana', texto: 'Semana' },
  { valor: 'mes', texto: 'Mes' },
  { valor: 'anio', texto: 'Año' },
];
const ESTADOS: { valor: EstadoGanancia; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'facturadas', texto: 'Facturadas' },
  { valor: 'pendientes', texto: 'Pendientes' },
];
const COLUMNAS = ['Periodo', 'Vida Digital USD', 'SANJH USD', 'Total USD'];
const CAMPO = 'rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm';
const TH = 'whitespace-nowrap px-3 py-2 text-left font-medium text-zinc-500';
const THR = 'whitespace-nowrap px-3 py-2 text-right font-medium text-zinc-500';
const TD = 'whitespace-nowrap px-3 py-2';
const TDR = 'whitespace-nowrap px-3 py-2 text-right tabular-nums';
// EXP-2: un 400 de la API trae el motivo real (p. ej. tope de 400 periodos):
// se propaga tal cual en vez de un mensaje generico.
async function leer(r: Response) {
  const cuerpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(cuerpo?.error || 'No se pudo cargar la ganancia.');
  return cuerpo;
}

// Se valida en el cliente para no gastar la API en un rango imposible (EXP-2).
function validarRango(desde: string, hasta: string): string | null {
  if (!desde || !hasta) return 'Indica las fechas Desde y Hasta.';
  if (desde > hasta) return 'La fecha Desde no puede ser posterior a Hasta.';
  return null;
}

// La UI no recalcula: pinta filas y totales tal como los devuelve la API (misma regla que Comisiones).
export function GananciaPeriodoPanel() {
  const [data, setData] = useState<InformeGanancia | null>(null);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('dia');
  const [estado, setEstado] = useState<EstadoGanancia>('facturadas');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const pedido = useRef(0);

  const cargar = useCallback((params: URLSearchParams) => {
    const id = ++pedido.current; // tambien descarta respuestas en vuelo si el rango es invalido
    const avisoRango =
      params.has('desde') || params.has('hasta')
        ? validarRango(params.get('desde') ?? '', params.get('hasta') ?? '')
        : null;
    if (avisoRango) {
      setAviso(avisoRango);
      setError(null);
      setData(null);
      setCargando(false);
      return;
    }
    setAviso(null);
    setCargando(true);
    setError(null);
    const qs = params.toString();
    fetch(`/api/vendedores/ganancia${qs ? `?${qs}` : ''}`)
      .then(leer)
      .then((json: InformeGanancia) => {
        if (id !== pedido.current) return; // respuesta vieja
        setData(json);
        setAgrupacion(json.agrupacion);
        setDesde(json.desde);
        setHasta(json.hasta);
        setEstado(json.estado);
        setCargando(false);
      })
      .catch((e: unknown) => {
        if (id !== pedido.current) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar la ganancia.');
        setCargando(false);
      });
  }, []);

  // Primer fetch sin parametros: el servidor decide los defaults y los devuelve.
  useEffect(() => {
    cargar(new URLSearchParams());
  }, [cargar]);

  // B-s10a-6: conserva estado y fechas elegidas al cambiar la agrupacion.
  const cambiarAgrupacion = (valor: Agrupacion) => {
    if (valor === agrupacion) return;
    const params = new URLSearchParams({ agrupar: valor, estado });
    if (desde && hasta) {
      params.set('desde', desde);
      params.set('hasta', hasta);
    }
    setAgrupacion(valor);
    cargar(params);
  };

  const cambiarEstado = (valor: EstadoGanancia) => {
    setEstado(valor);
    cargar(new URLSearchParams({ agrupar: agrupacion, desde, hasta, estado: valor }));
  };

  const cambiarFecha = (campo: 'desde' | 'hasta', valor: string) => {
    if (campo === 'desde') setDesde(valor);
    else setHasta(valor);
    cargar(
      new URLSearchParams({
        agrupar: agrupacion,
        desde: campo === 'desde' ? valor : desde,
        hasta: campo === 'hasta' ? valor : hasta,
        estado,
      })
    );
  };

  return (
    <section className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
      <h2 className="text-xl font-bold tracking-tight">Ganancia por periodo</h2>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Agrupar por">
          {GRUPOS.map((g) => (
            <button
              key={g.valor}
              type="button"
              aria-pressed={agrupacion === g.valor}
              onClick={() => cambiarAgrupacion(g.valor)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                agrupacion === g.valor
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 dark:border-zinc-700'
              }`}
            >
              {g.texto}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Desde
          <input aria-label="Desde" type="date" value={desde} onChange={(e) => cambiarFecha('desde', e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Hasta
          <input aria-label="Hasta" type="date" value={hasta} onChange={(e) => cambiarFecha('hasta', e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Estado
          <select aria-label="Estado" value={estado} onChange={(e) => cambiarEstado(e.target.value as EstadoGanancia)} className={CAMPO}>
            {ESTADOS.map((o) => (
              <option key={o.valor} value={o.valor}>{o.texto}</option>
            ))}
          </select>
        </label>
      </div>

      {cargando && <p className="py-8 text-center text-zinc-400">Cargando...</p>}
      {!cargando && aviso && <p role="alert" className="py-8 text-center text-red-600">{aviso}</p>}
      {!cargando && !aviso && error && <p className="py-8 text-center text-red-600">{error}</p>}

      {!cargando && !error && data && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
          <p className="text-xs text-zinc-500">Total del rango</p>
          <p className="text-2xl font-bold tabular-nums">{formatUSD(data.totales.total_usd)}</p>
          <p className="text-xs text-zinc-500">
            Vida Digital {formatUSD(data.totales.vida_usd)} · SANJH {formatUSD(data.totales.sanjh_usd)}
          </p>
        </div>
      )}

      {!cargando && !error && data && data.filas.length === 0 && (
        <p className="py-8 text-center text-zinc-400">No hay ventas en el periodo.</p>
      )}

      {!cargando && !error && data && data.filas.length > 0 && (
        <>
          {data.truncado && (
            <p className="text-xs text-amber-600">Se muestran los últimos 400 periodos; acota el rango.</p>
          )}
          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className={TH}>{COLUMNAS[0]}</th>
                  <th className={THR}>{COLUMNAS[1]}</th>
                  <th className={THR}>{COLUMNAS[2]}</th>
                  <th className={THR}>{COLUMNAS[3]}</th>
                </tr>
              </thead>
              <tbody>
                {data.filas.map((f) => (
                  <tr key={f.periodo} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className={TD}>{f.etiqueta}</td>
                    <td className={TDR}>{formatUSD(f.vida_usd)}</td>
                    <td className={TDR}>{formatUSD(f.sanjh_usd)}</td>
                    <td className={TDR}>{formatUSD(f.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50 dark:bg-zinc-900">
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th className={TH}>TOTAL</th>
                  <th className={THR}>{formatUSD(data.totales.vida_usd)}</th>
                  <th className={THR}>{formatUSD(data.totales.sanjh_usd)}</th>
                  <th className={THR}>{formatUSD(data.totales.total_usd)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
