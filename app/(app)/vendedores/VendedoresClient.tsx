'use client';

import { useEffect, useRef, useState } from 'react';
import { fechaDiaCL, hoyCL, lunesSemanaCL, primerDiaMesCL } from '@/lib/fechas';
import { fechaFiltroValida, type FiltrosGuardados } from '@/lib/filtros-validacion';
import { formatUSD } from '@/lib/utils';
import type { NotaVenta } from '@/lib/vendedores-notas';

type EstadoFiltro = 'todas' | 'pendientes' | 'facturadas';
type EmpresaFiltro = 'todas' | 'vida' | 'sanjh';

// Mismo orden de claves al restaurar y al guardar: permite comparar con JSON.stringify.
function canonizar(f: FiltrosGuardados): string {
  return JSON.stringify({
    vendedor: f.vendedor,
    desde: f.desde,
    hasta: f.hasta,
    visaDesde: f.visaDesde,
    visaHasta: f.visaHasta,
    estado: f.estado,
    empresa: f.empresa,
  });
}

// D3: fechas calculadas solo dentro de efectos/eventos. Sin rango de visacion,
// las fechas de venta nunca quedan vacias (decision S3 #2): se ve el mes en curso.
function filtrosIniciales(f: FiltrosGuardados | null): FiltrosGuardados {
  const filtros: FiltrosGuardados = {
    vendedor: f?.vendedor ?? '',
    desde: f?.desde ?? '',
    hasta: f?.hasta ?? '',
    visaDesde: f?.visaDesde ?? '',
    visaHasta: f?.visaHasta ?? '',
    estado: f?.estado || 'todas',
    empresa: f?.empresa || 'todas',
  };
  if (!filtros.visaDesde && !filtros.visaHasta && !filtros.desde && !filtros.hasta) {
    return { ...filtros, desde: primerDiaMesCL(), hasta: hoyCL() };
  }
  return filtros;
}

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
  const [inicializando, setInicializando] = useState(true);
  const [avisoGuardado, setAvisoGuardado] = useState(false);

  const pedido = useRef(0);
  const guardado = useRef('');
  const hayVisacion = Boolean(visaDesde || visaHasta);

  // EXP-1/EXP-3: solo se consulta (y se guarda) con fechas completas y rangos validos.
  const fechasCompletas = [desde, hasta, visaDesde, visaHasta].every(fechaFiltroValida);
  const errorFechas = !fechasCompletas
    ? 'Hay una fecha incompleta o inválida.'
    : desde && hasta && desde > hasta
      ? 'La fecha desde es posterior a la fecha hasta'
      : visaDesde && visaHasta && visaDesde > visaHasta
        ? 'La fecha de visación desde es posterior a la fecha de visación hasta'
        : '';

  // R6: restaurar ANTES de pedir notas (una sola consulta inicial).
  useEffect(() => {
    let vivo = true;
    const aplicar = (f: FiltrosGuardados | null) => {
      if (!vivo) return;
      const filtros = filtrosIniciales(f);
      setVendedor(filtros.vendedor);
      setDesde(filtros.desde);
      setHasta(filtros.hasta);
      setVisaDesde(filtros.visaDesde);
      setVisaHasta(filtros.visaHasta);
      setEstado(filtros.estado);
      setEmpresa(filtros.empresa);
      guardado.current = canonizar(filtros);
      setInicializando(false);
    };
    fetch('/api/vendedores/filtros')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { filtros: FiltrosGuardados | null }) => aplicar(json?.filtros ?? null))
      .catch(() => aplicar(null)); // sin guardado se arranca igual con el default
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (inicializando || errorFechas) return;
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
  }, [inicializando, errorFechas, vendedor, desde, hasta, visaDesde, visaHasta, estado, empresa]);

  // R6: guardar con debounce. Un fallo no rompe la pantalla: solo avisa.
  useEffect(() => {
    if (inicializando || errorFechas) return;
    const json = canonizar({ vendedor, desde, hasta, visaDesde, visaHasta, estado, empresa });
    if (json === guardado.current) return;
    const t = setTimeout(() => {
      fetch('/api/vendedores/filtros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          guardado.current = json;
          setAvisoGuardado(false);
        })
        .catch(() => setAvisoGuardado(true));
    }, 500);
    return () => clearTimeout(t);
  }, [inicializando, errorFechas, vendedor, desde, hasta, visaDesde, visaHasta, estado, empresa]);

  // D3: la fecha de hoy se calcula en el click, nunca durante el render.
  const atajo = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
  };

  // Decision S3 #2: vaciar las fechas de venta sin visacion vuelve al mes en curso.
  const limpiarFechasVenta = () => {
    if (visaDesde || visaHasta) {
      setDesde('');
      setHasta('');
      return;
    }
    setDesde(primerDiaMesCL());
    setHasta(hoyCL());
  };

  const cambiarFechaVenta = (valor: string, cual: 'desde' | 'hasta') => {
    const nuevoDesde = cual === 'desde' ? valor : desde;
    const nuevoHasta = cual === 'hasta' ? valor : hasta;
    if (!nuevoDesde && !nuevoHasta && !visaDesde && !visaHasta) {
      setDesde(primerDiaMesCL());
      setHasta(hoyCL());
      return;
    }
    if (cual === 'desde') setDesde(valor);
    else setHasta(valor);
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
            onChange={(e) => cambiarFechaVenta(e.target.value, 'desde')}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Fecha de venta hasta
          <input
            aria-label="Fecha de venta hasta"
            type="date"
            value={hasta}
            onChange={(e) => cambiarFechaVenta(e.target.value, 'hasta')}
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
          <button type="button" onClick={limpiarFechasVenta} className="rounded-md border px-2 py-1.5 text-xs">
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
      {avisoGuardado && <p className="text-xs text-amber-600">No se pudieron guardar los filtros.</p>}

      {errorFechas && <p className="py-8 text-center text-amber-600">{errorFechas}</p>}
      {!errorFechas && cargando && <p className="py-8 text-center text-zinc-400">Cargando...</p>}
      {!errorFechas && !cargando && error && (
        <p className="py-8 text-center text-red-600">Error al cargar las notas.</p>
      )}

      {!errorFechas && !cargando && !error && data && (
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
