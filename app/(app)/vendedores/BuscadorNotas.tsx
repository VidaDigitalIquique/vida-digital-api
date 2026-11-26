'use client';

import { useEffect, useRef, useState } from 'react';
import { fechaDiaCL } from '@/lib/fechas';
import { formatUSD } from '@/lib/utils';
import type { NotaVenta } from '@/lib/vendedores-notas';

interface Props {
  puedeVerDetalle: boolean;
  onVerDetalle?: (empresa: 'vida' | 'sanjh', nota: string) => void;
}

const opcionId = (i: number) => `buscador-nota-op-${i}`;
const estadoTexto = (e: NotaVenta['estado']) => (e === 'facturada' ? 'Facturada' : 'Pendiente');

/** Buscador efimero por N° de nota o cliente; no toca los filtros ni la tabla. */
export function BuscadorNotas({ puedeVerDetalle, onVerDetalle }: Props) {
  const [texto, setTexto] = useState('');
  const [notas, setNotas] = useState<NotaVenta[]>([]);
  const [estado, setEstado] = useState<'idle' | 'buscando' | 'ok' | 'error'>('idle');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [cabecera, setCabecera] = useState<NotaVenta | null>(null);
  const pedidoBusqueda = useRef(0);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alClicFuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', alClicFuera);
    return () => document.removeEventListener('mousedown', alClicFuera);
  }, []);

  useEffect(() => {
    const id = ++pedidoBusqueda.current; // invalida respuestas en vuelo al tipear
    const q = texto.trim();
    if (q.length < 2) {
      setNotas([]); setEstado('idle'); setAbierto(false); setActivo(-1);
      return;
    }
    const temporizador = setTimeout(() => {
      setEstado('buscando'); setAbierto(true);
      fetch(`/api/vendedores/buscar?q=${encodeURIComponent(q)}`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((json: { notas?: NotaVenta[] }) => {
          if (id !== pedidoBusqueda.current) return;
          setNotas(json?.notas ?? []); setEstado('ok'); setActivo(-1);
        })
        .catch(() => {
          if (id !== pedidoBusqueda.current) return;
          setNotas([]); setEstado('error');
        });
    }, 250);
    return () => clearTimeout(temporizador);
  }, [texto]);

  useEffect(() => {
    if (!cabecera) return;
    const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setCabecera(null); };
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [cabecera]);

  const elegir = (n: NotaVenta) => {
    setAbierto(false); setActivo(-1);
    if (puedeVerDetalle) onVerDetalle?.(n.empresa, n.nota);
    else setCabecera(n);
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setTexto(''); setNotas([]); setEstado('idle'); setAbierto(false); setActivo(-1);
      return;
    }
    if (!abierto || notas.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, notas.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); elegir(notas[activo]); }
  };

  const mostrarLista = abierto && texto.trim().length >= 2;
  const datos = cabecera
    ? [
        ['Empresa', cabecera.empresa_nombre], ['Cliente', cabecera.cliente],
        ['Vendedor', cabecera.vendedor], ['Fecha venta', fechaDiaCL(cabecera.fecha_venta)],
        ['Total USD', formatUSD(cabecera.total_usd)], ['Estado', estadoTexto(cabecera.estado)],
        ['N° visación', cabecera.visacion ?? '—'],
        ['Facturación', cabecera.fecha_facturacion ? fechaDiaCL(cabecera.fecha_facturacion) : '—'],
      ]
    : [];

  return (
    <div ref={contenedor} className="relative max-w-xl">
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        role="combobox"
        aria-label="Buscar por N° de nota o cliente"
        aria-expanded={mostrarLista}
        aria-controls="buscador-notas-lista"
        aria-autocomplete="list"
        aria-activedescendant={activo >= 0 ? opcionId(activo) : undefined}
        placeholder="Buscar por N° de nota o cliente"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alTeclear}
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
      />

      {mostrarLista && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {estado === 'buscando' && <p className="px-3 py-2 text-sm text-zinc-400">Buscando...</p>}
          {estado === 'error' && (
            <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400">No se pudo buscar</p>
          )}
          {estado === 'ok' && notas.length === 0 && (
            <p className="px-3 py-2 text-sm text-zinc-400">Sin resultados para “{texto.trim()}”</p>
          )}
          {estado === 'ok' && notas.length > 0 && (
            <ul role="listbox" id="buscador-notas-lista" aria-label="Resultados de la busqueda" className="max-h-80 overflow-y-auto">
              {notas.map((n, i) => (
                <li
                  key={`${n.empresa}-${n.nota}`}
                  id={opcionId(i)}
                  role="option"
                  aria-selected={i === activo}
                  onClick={() => elegir(n)}
                  className={`cursor-pointer border-t border-zinc-100 px-3 py-2 text-sm first:border-t-0 dark:border-zinc-800 ${
                    i === activo ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono font-medium">{n.nota}</span>
                    <span className="text-zinc-500">{n.empresa_nombre}</span>
                    <span className="font-medium">{n.cliente}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-zinc-500">
                    <span>{fechaDiaCL(n.fecha_venta)}</span>
                    <span>{formatUSD(n.total_usd)}</span>
                    <span className={n.estado === 'facturada' ? 'font-medium text-green-600 dark:text-green-400' : 'font-medium text-red-600 dark:text-red-400'}>
                      {estadoTexto(n.estado)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {cabecera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCabecera(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Nota ${cabecera.nota}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-md bg-white p-4 shadow-xl dark:bg-zinc-950"
          >
            <h2 className="mb-3 text-lg font-bold">Nota {cabecera.nota}</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {datos.map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <dt className="text-xs text-zinc-500">{etiqueta}</dt>
                  <dd className="font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 text-right">
              <button type="button" onClick={() => setCabecera(null)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
