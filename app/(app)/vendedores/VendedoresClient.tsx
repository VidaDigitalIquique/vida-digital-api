'use client';

import { useEffect, useRef, useState } from 'react';
import { fechaDiaCL, hoyCL, lunesSemanaCL, primerDiaMesCL } from '@/lib/fechas';
import { formatUSD } from '@/lib/utils';
import type { NotaVenta } from '@/lib/vendedores-notas';

type EstadoFiltro = 'todas' | 'pendientes' | 'facturadas';
type EmpresaFiltro = 'todas' | 'vida' | 'sanjh';

interface Respuesta {
  notas: NotaVenta[];
  vendedores: string[];
  total: number;
  limit: number;
}

const COLUMNAS = [
  'Empresa',
  'Fecha venta',
  'Nota',
  'Cliente',
  'Vendedor',
  'Total USD',
  'Estado',
  'N° visación',
  'Facturación',
];

export function VendedoresClient() {
  const [vendedor, setVendedor] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [visaDesde, setVisaDesde] = useState('');
  const [visaHasta, setVisaHasta] = useState('');
  const [estado, setEstado] = useState<EstadoFiltro>('todas');
  const [empresa, setEmpresa] = useState<EmpresaFiltro>('todas');

  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const pedido = useRef(0);
  const hayVisacion = Boolean(visaDesde || visaHasta);

  useEffect(() => {
    const id = ++pedido.current;
    const params = new URLSearchParams();
    if (vendedor) params.set('vendedor', vendedor);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (visaDesde) params.set('visaDesde', visaDesde);
    if (visaHasta) params.set('visaHasta', visaHasta);
    if (estado !== 'todas') params.set('estado', estado);
    if (empresa !== 'todas') params.set('empresa', empresa);

    const qs = params.toString();
    setCargando(true);
    setError(false);
    fetch(qs ? `/api/vendedores/notas?${qs}` : '/api/vendedores/notas')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: Respuesta) => {
        if (id !== pedido.current) return; // respuesta vieja: llego fuera de orden
        setData(json);
        setCargando(false);
      })
      .catch(() => {
        if (id !== pedido.current) return;
        setError(true);
        setCargando(false);
      });
  }, [vendedor, desde, hasta, visaDesde, visaHasta, estado, empresa]);

  // D3: la fecha de hoy se calcula en el click, nunca durante el render.
  const atajo = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
  };

  const cambiarVisa = (valor: string, cual: 'desde' | 'hasta') => {
    if (cual === 'desde') setVisaDesde(valor);
    else setVisaHasta(valor);
    if (valor) setEstado('facturadas');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">VENDEDORES</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Vendedor
          <select
            aria-label="Vendedor"
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            className="min-w-[160px] rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {(data?.vendedores ?? []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Fecha de venta desde
          <input
            aria-label="Fecha de venta desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Fecha de venta hasta
          <input
            aria-label="Fecha de venta hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>

        <div className="flex gap-1">
          <button type="button" onClick={() => atajo(hoyCL(), hoyCL())} className="rounded-md border px-2 py-1.5 text-xs">
            Hoy
          </button>
          <button type="button" onClick={() => atajo(lunesSemanaCL(), hoyCL())} className="rounded-md border px-2 py-1.5 text-xs">
            Esta semana
          </button>
          <button type="button" onClick={() => atajo(primerDiaMesCL(), hoyCL())} className="rounded-md border px-2 py-1.5 text-xs">
            Este mes
          </button>
          <button type="button" onClick={() => atajo('', '')} className="rounded-md border px-2 py-1.5 text-xs">
            Limpiar fechas de venta
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Visación desde
          <input
            aria-label="Fecha de visación desde"
            type="date"
            value={visaDesde}
            onChange={(e) => cambiarVisa(e.target.value, 'desde')}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Visación hasta
          <input
            aria-label="Fecha de visación hasta"
            type="date"
            value={visaHasta}
            onChange={(e) => cambiarVisa(e.target.value, 'hasta')}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Estado
          <select
            aria-label="Estado"
            value={estado}
            onChange={(e) => setEstado(hayVisacion ? 'facturadas' : (e.target.value as EstadoFiltro))}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="todas">Todas</option>
            <option value="pendientes" disabled={hayVisacion}>
              Pendientes
            </option>
            <option value="facturadas">Facturadas</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Empresa
          <select
            aria-label="Empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value as EmpresaFiltro)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="todas">Todas</option>
            <option value="vida">Vida Digital</option>
            <option value="sanjh">SANJH</option>
          </select>
        </label>
      </div>

      {hayVisacion && (
        <p className="text-xs text-zinc-500">Con rango de visación solo se muestran notas facturadas.</p>
      )}

      {cargando && <p className="py-8 text-center text-zinc-400">Cargando...</p>}
      {!cargando && error && <p className="py-8 text-center text-red-600">Error al cargar las notas.</p>}

      {!cargando && !error && data && (
        <>
          {data.total > data.notas.length && (
            <p className="text-sm text-amber-600">
              Mostrando los primeros {data.notas.length} de {data.total}
            </p>
          )}
          {data.notas.length === 0 ? (
            <p className="py-8 text-center text-zinc-400">No hay notas para los filtros elegidos.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {COLUMNAS.map((c) => (
                      <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-medium text-zinc-500">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.notas.map((n) => (
                    <tr key={`${n.empresa}-${n.nota}`} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="whitespace-nowrap px-3 py-2">{n.empresa_nombre}</td>
                      <td className="whitespace-nowrap px-3 py-2">{fechaDiaCL(n.fecha_venta)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">{n.nota}</td>
                      <td className="px-3 py-2">{n.cliente}</td>
                      <td className="whitespace-nowrap px-3 py-2">{n.vendedor}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formatUSD(n.total_usd)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {n.estado === 'facturada' ? 'Facturada' : 'Pendiente'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{n.visacion ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {n.fecha_facturacion ? fechaDiaCL(n.fecha_facturacion) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
