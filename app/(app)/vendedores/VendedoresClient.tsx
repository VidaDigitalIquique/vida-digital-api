'use client';

import { useEffect, useRef, useState } from 'react';
import { fechaDiaCL, hoyCL, lunesSemanaCL, primerDiaMesCL } from '@/lib/fechas';
import { fechaFiltroValida, type FiltrosGuardados, type ModoFecha } from '@/lib/filtros-validacion';
import { formatUSD } from '@/lib/utils';
import type { NotaVenta } from '@/lib/vendedores-notas';
import { BuscadorNotas } from './BuscadorNotas';
import { NotaDetalleModal } from './NotaDetalleModal';
import { PaginacionNotas } from './PaginacionNotas';

type EstadoFiltro = 'todas' | 'pendientes' | 'facturadas';
type EmpresaFiltro = 'todas' | 'vida' | 'sanjh';

// Mismo orden de claves al restaurar y al guardar: permite comparar con JSON.stringify.
function canonizar(f: FiltrosGuardados): string {
  return JSON.stringify({
    vendedor: f.vendedor,
    desde: f.desde,
    hasta: f.hasta,
    estado: f.estado,
    empresa: f.empresa,
    modoFecha: f.modoFecha,
  });
}

// D3: fechas calculadas solo dentro de efectos/eventos. El default de mes en
// curso solo aplica si NO hay filtros guardados: un guardado con fechas vacias
// se respeta tal cual (EXP-1).
function filtrosIniciales(f: FiltrosGuardados | null): FiltrosGuardados {
  const filtros: FiltrosGuardados = {
    vendedor: f?.vendedor ?? '',
    desde: f?.desde ?? '',
    hasta: f?.hasta ?? '',
    estado: f?.estado || 'todas',
    empresa: f?.empresa || 'todas',
    modoFecha: f?.modoFecha || 'venta',
  };
  if (f) return filtros;
  return { ...filtros, desde: primerDiaMesCL(), hasta: hoyCL() };
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

export function VendedoresClient({
  puedeVerDetalle = true,
  buscadorActivo = false,
  buscadorCodigoActivo = false,
}: {
  puedeVerDetalle?: boolean;
  buscadorActivo?: boolean;
  buscadorCodigoActivo?: boolean;
} = {}) {
  const [vendedor, setVendedor] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [estado, setEstado] = useState<EstadoFiltro>('todas');
  const [modoFecha, setModoFecha] = useState<ModoFecha>('venta');
  const [empresa, setEmpresa] = useState<EmpresaFiltro>('todas');
  const [pagina, setPagina] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState<25 | 50 | 100>(25);

  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [inicializando, setInicializando] = useState(true);
  const [avisoGuardado, setAvisoGuardado] = useState(false);

  const pedido = useRef(0);
  const guardado = useRef('');
  const pendiente = useRef<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seleccion, setSeleccion] = useState<{ empresa: 'vida' | 'sanjh'; nota: string } | null>(null);
  const paginas = Math.max(1, Math.ceil((data?.notas.length ?? 0) / tamanoPagina));
  const paginaEfectiva = Math.max(1, Math.min(pagina, paginas));
  const notasVisibles = data?.notas.slice((paginaEfectiva - 1) * tamanoPagina, paginaEfectiva * tamanoPagina);

  // Incluso un filtro temporalmente invalido reinicia la navegacion local.
  useEffect(() => {
    setPagina(1);
  }, [vendedor, desde, hasta, estado, empresa, modoFecha]);

  const cambiarTamano = (tamano: 25 | 50 | 100) => {
    setTamanoPagina(tamano);
    setPagina(Math.min(paginaEfectiva, Math.max(1, Math.ceil((data?.notas.length ?? 0) / tamano))));
  };

  // EXP-1: si se sale antes del debounce, el ultimo cambio se guarda igual.
  useEffect(() => {
    const guardarYa = () => {
      const json = pendiente.current;
      if (!json) return;
      pendiente.current = null;
      if (temporizador.current) clearTimeout(temporizador.current);
      fetch('/api/vendedores/filtros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: json,
        keepalive: true,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          guardado.current = json;
        })
        .catch(() => {});
    };
    window.addEventListener('pagehide', guardarYa);
    return () => {
      window.removeEventListener('pagehide', guardarYa);
      guardarYa();
    };
  }, []);

  // EXP-1/EXP-3: solo se consulta (y se guarda) con fechas completas y rangos validos.
  const fechasCompletas = [desde, hasta].every(fechaFiltroValida);
  const errorFechas = !fechasCompletas
    ? 'Hay una fecha incompleta o inválida.'
    : desde && hasta && desde > hasta
      ? 'La fecha desde es posterior a la fecha hasta'
      : '';

  // R6: restaurar ANTES de pedir notas (una sola consulta inicial).
  useEffect(() => {
    let vivo = true;
    const aplicar = (f: FiltrosGuardados | null) => {
      if (!vivo) return;
      const filtros = filtrosIniciales(f);
      guardado.current = canonizar(filtros);
      // s12c: en facturacion no existe "Todas"/"Pendientes"; un guardado viejo se
      // normaliza antes del primer fetch. guardado.current conserva el valor crudo
      // para que el efecto de guardado persista el normalizado.
      if (filtros.modoFecha === 'facturacion') filtros.estado = 'facturadas';
      setVendedor(filtros.vendedor);
      setDesde(filtros.desde);
      setHasta(filtros.hasta);
      setEstado(filtros.estado);
      setEmpresa(filtros.empresa);
      setModoFecha(filtros.modoFecha);
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
    if (estado !== 'todas') params.set('estado', estado);
    if (empresa !== 'todas') params.set('empresa', empresa);
    if (modoFecha === 'facturacion') params.set('modoFecha', 'facturacion');

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
        setPagina(1);
        setCargando(false);
      })
      .catch(() => {
        if (id !== pedido.current) return;
        setError(true);
        setCargando(false);
      });
  }, [inicializando, errorFechas, vendedor, desde, hasta, estado, empresa, modoFecha]);

  // R6: guardar con debounce. Un fallo no rompe la pantalla: solo avisa.
  useEffect(() => {
    if (inicializando || errorFechas) return;
    const json = canonizar({ vendedor, desde, hasta, estado, empresa, modoFecha });
    if (json === guardado.current) {
      pendiente.current = null;
      return;
    }
    pendiente.current = json;
    const t = setTimeout(() => {
      pendiente.current = null;
      temporizador.current = null;
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
    temporizador.current = t;
    return () => clearTimeout(t);
  }, [inicializando, errorFechas, vendedor, desde, hasta, estado, empresa, modoFecha]);

  // D3: la fecha de hoy se calcula en el click, nunca durante el render.
  const atajo = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
  };

  // EXP-1: limpiar deja las fechas vacias (= sin limite); no vuelve a imponer el mes.
  const limpiarFechas = () => {
    setDesde('');
    setHasta('');
  };

  // En facturacion la nota aun pendiente no tiene fecha: el estado se fuerza a facturadas.
  const cambiarModo = (modo: ModoFecha) => {
    setModoFecha(modo);
    if (modo === 'facturacion') setEstado('facturadas');
  };

  // EXP-3: no pintar filtros con valores provisorios antes de restaurar; el
  // fetch de notas ya espera a inicializando (effects de arriba).
  if (inicializando) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">VENDEDORES</h1>
        <p className="py-8 text-center text-zinc-400">Cargando filtros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">VENDEDORES</h1>

      {buscadorActivo && (
        <BuscadorNotas
          puedeVerDetalle={puedeVerDetalle}
          buscadorCodigoActivo={buscadorCodigoActivo}
          onVerDetalle={(empresa, nota) => setSeleccion({ empresa, nota })}
        />
      )}

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

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>Buscar por:</span>
          <span className={modoFecha === 'venta' ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}>
            Fecha de nota de venta
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={modoFecha === 'facturacion'}
            aria-label="Buscar por fecha de facturación"
            onClick={() => cambiarModo(modoFecha === 'facturacion' ? 'venta' : 'facturacion')}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
              modoFecha === 'facturacion' ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                modoFecha === 'facturacion' ? 'translate-x-5 dark:bg-zinc-900' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span
            className={modoFecha === 'facturacion' ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}
          >
            Fecha de facturación
          </span>
        </div>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Desde
          <input
            aria-label="Fecha desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Hasta
          <input
            aria-label="Fecha hasta"
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
          <button type="button" onClick={limpiarFechas} className="rounded-md border px-2 py-1.5 text-xs">
            Limpiar fechas
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Estado
          <select
            aria-label="Estado"
            value={modoFecha === 'facturacion' ? 'facturadas' : estado}
            onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="todas" disabled={modoFecha === 'facturacion'}>
              Todas
            </option>
            <option value="pendientes" disabled={modoFecha === 'facturacion'}>
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

      {modoFecha === 'facturacion' && (
        <p className="text-xs text-zinc-500">
          Solo notas facturadas: las pendientes aún no tienen fecha de facturación.
        </p>
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
                  {notasVisibles?.map((n) => (
                    <tr
                      key={`${n.empresa}-${n.nota}`}
                      tabIndex={puedeVerDetalle ? 0 : -1}
                      onClick={puedeVerDetalle ? () => setSeleccion({ empresa: n.empresa, nota: n.nota }) : undefined}
                      onKeyDown={puedeVerDetalle ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSeleccion({ empresa: n.empresa, nota: n.nota });
                        }
                      } : undefined}
                      className={`${puedeVerDetalle ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ' : ''}border-t border-zinc-100 dark:border-zinc-800`}
                    >
                      <td className="whitespace-nowrap px-3 py-2">{n.empresa_nombre}</td>
                      <td className="whitespace-nowrap px-3 py-2">{fechaDiaCL(n.fecha_venta)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">{n.nota}</td>
                      <td className="px-3 py-2">{n.cliente}</td>
                      <td className="whitespace-nowrap px-3 py-2">{n.vendedor}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formatUSD(n.total_usd)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={n.estado === 'facturada'
                          ? 'font-medium text-green-600 dark:text-green-400'
                          : 'font-medium text-red-600 dark:text-red-400'}>
                          {n.estado === 'facturada' ? 'Facturada' : 'Pendiente'}
                        </span>
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
          <PaginacionNotas
            pagina={paginaEfectiva}
            tamanoPagina={tamanoPagina}
            total={data.notas.length}
            onPaginaChange={setPagina}
            onTamanoPaginaChange={cambiarTamano}
          />
        </>
      )}

      {puedeVerDetalle && seleccion && (
        <NotaDetalleModal
          empresa={seleccion.empresa}
          nota={seleccion.nota}
          onClose={() => setSeleccion(null)}
        />
      )}
    </div>
  );
}
