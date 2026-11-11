'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { fechaDiaCL } from '@/lib/fechas';
import { formatUSD } from '@/lib/utils';
import { gananciaLinea, porcentajeSobreCosto, totalGanancia, type DetalleNota, type LineaDetalle } from '@/lib/vendedores-detalle';

const COLUMNAS = ['IMAGEN', 'CÓDIGO', 'COSTO', '% SOBRE EL COSTO', 'CANTIDAD (cajas)', 'PRECIO DE VENTA', 'GANANCIA USD'];

interface Props {
  empresa: 'vida' | 'sanjh';
  nota: string;
  onClose: () => void;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{etiqueta}</dt>
      <dd className="text-sm">{valor}</dd>
    </div>
  );
}

// D11: sin imagen_url no se inventa una URL de Cloudinary.
function Imagen({ linea, empresa }: { linea: LineaDetalle; empresa: 'vida' | 'sanjh' }) {
  if (!linea.imagen_url) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 px-1 text-center text-[10px] text-zinc-400 dark:border-zinc-800">
        {linea.codigo}
      </span>
    );
  }
  return (
    <span className="relative block h-10 w-10 overflow-hidden rounded-md">
      <ImageWithFallback src={linea.imagen_url} codigo={linea.codigo} empresaSlug={empresa} fill className="h-10 w-10" />
    </span>
  );
}

function Contenido({ detalle }: { detalle: DetalleNota }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Dato etiqueta="Empresa" valor={detalle.empresa_nombre} />
        <Dato etiqueta="Nota" valor={detalle.nota} />
        <Dato etiqueta="Cliente comprador" valor={detalle.cliente} />
        <Dato etiqueta="Cliente factura" valor={detalle.cliente_factura || '—'} />
        <Dato etiqueta="Vendedor" valor={detalle.vendedor} />
        <Dato etiqueta="Fecha de venta" valor={fechaDiaCL(detalle.fecha_venta)} />
        <Dato etiqueta="Estado" valor={detalle.estado === 'facturada' ? 'Facturada' : 'Pendiente'} />
        <Dato etiqueta="Visación" valor={detalle.visacion ?? '—'} />
        <Dato etiqueta="Fecha de visación" valor={detalle.fecha_visacion ? fechaDiaCL(detalle.fecha_visacion) : '—'} />
        <Dato etiqueta="Total real" valor={formatUSD(detalle.total_usd)} />
      </dl>

      <div className="w-full min-w-0 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
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
            {detalle.lineas.map((l, i) => {
              const pct = porcentajeSobreCosto(l.precio, l.costo);
              return (
                <tr key={`${l.codigo}-${i}`} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    <Imagen linea={l} empresa={detalle.empresa} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{l.codigo}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatUSD(l.costo)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{pct === null ? '—' : `${pct.toFixed(2)} %`}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {l.cajas} cajas <span className="text-xs text-zinc-400">{l.unidades} u</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatUSD(l.precio)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatUSD(gananciaLinea(l.precio, l.costo, l.unidades))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-right text-sm font-medium">Total ganancia: {formatUSD(totalGanancia(detalle.lineas))}</p>

      {detalle.diferencia_usd !== null && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          Esta nota tiene líneas en el sistema que no suman al total de WinFac (diferencia USD{' '}
          {formatUSD(detalle.diferencia_usd)}): la ganancia por línea puede incluir productos que no son
          parte de la venta
        </p>
      )}
    </>
  );
}

export function NotaDetalleModal({ empresa, nota, onClose }: Props) {
  const [detalle, setDetalle] = useState<DetalleNota | null>(null);
  const [error, setError] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    const id = ++pedido.current;
    setDetalle(null);
    setError(false);
    fetch(`/api/vendedores/notas/${empresa}/${nota}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: DetalleNota) => {
        if (id === pedido.current) setDetalle(json);
      })
      .catch(() => {
        if (id === pedido.current) setError(true);
      });
  }, [empresa, nota]);

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Detalle de nota {nota}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="py-6 text-center text-red-600">Error al cargar el detalle de la nota.</p>
        ) : !detalle ? (
          <p className="py-6 text-center text-zinc-400">Cargando detalle...</p>
        ) : (
          <Contenido detalle={detalle} />
        )}
      </DialogContent>
    </Dialog>
  );
}
