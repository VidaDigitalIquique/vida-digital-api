'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { cn, formatRut, formatUSD } from '@/lib/utils';

interface KardexClientePageProps {
  session: any;
  empresasMap: Record<number, string>;
}

type ClienteBusqueda = {
  kcodclie: string;
  nombress: string;
  rutclien?: string | null;
  digiveri?: string | null;
  celular?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  comprador?: string | null;
  foto_url?: string | null;
};

type KardexProducto = {
  empresa_id?: number | null;
  codigo: string;
  detalle: string;
  precio_min: number;
  precio_max: number;
  precio_ultimo: number;
  total_unidades: number;
  ultima_compra: string;
  imagen_url?: string | null;
  saldo_zofri?: number | null;
  saldo_bodega?: number | null;
  cantcaja?: number | null;
};

function formatSaldo(unidades?: number | null, cantcaja?: number | null) {
  const unidadesValue = Number(unidades ?? 0);
  const cajas =
    cantcaja && cantcaja > 0
      ? new Intl.NumberFormat('es-CL', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(unidadesValue / cantcaja)
      : '—';

  return {
    unidades: new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(unidadesValue),
    cajas,
  };
}

export function KardexClientePage({ session, empresasMap }: KardexClientePageProps) {
  void session;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [clientes, setClientes] = useState<ClienteBusqueda[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteBusqueda | null>(null);
  const [productos, setProductos] = useState<KardexProducto[]>([]);
  const [tipoCliente, setTipoCliente] = useState<'comprador' | 'factura'>('comprador');
  const [loading, setLoading] = useState(false);
  const [clientPhotoError, setClientPhotoError] = useState(false);

  const hasSearch = debouncedSearch.trim().length >= 2;

  const vidaEmpresaId = useMemo(() => {
    const match = Object.entries(empresasMap).find(([, slug]) => slug.includes('vida'));
    return match ? Number(match[0]) : 2;
  }, [empresasMap]);

  const empresaSlugById = useMemo(() => {
    return (empresaId?: number | null) => {
      if (empresaId && empresasMap[empresaId]) return empresasMap[empresaId];
      return empresasMap[vidaEmpresaId] || 'vidadigital';
    };
  }, [empresasMap, vidaEmpresaId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (selectedCliente?.foto_url) {
      setClientPhotoError(false);
    }
  }, [selectedCliente]);

  useEffect(() => {
    if (!selectedCliente) return;
    void handleBuscarKardex(selectedCliente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCliente]);

  useEffect(() => {
    async function fetchClientes() {
      if (debouncedSearch.trim().length < 2) {
        setClientes([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        const queryParams = new URLSearchParams({
          q: debouncedSearch.trim(),
          empresaSlug: 'vida',
        });
        const res = await fetch(`/api/ventas/clientes?${queryParams.toString()}`);
        if (res.ok) {
          const { data } = await res.json();
          setClientes(data || []);
        } else {
          setClientes([]);
        }
      } catch (error) {
        console.error(error);
        setClientes([]);
      } finally {
        setSearching(false);
      }
    }

    fetchClientes();
  }, [debouncedSearch]);

  async function handleBuscarKardex(cliente: ClienteBusqueda) {
    if (!cliente) return;

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        empresaSlug: 'vida',
        tipoCliente,
      });
      const res = await fetch(
        `/api/ventas/clientes/${cliente.kcodclie}/kardex?${queryParams.toString()}`
      );

      if (res.ok) {
        const { cliente: clienteData, productos: productosData } = await res.json();
        setSelectedCliente(clienteData || cliente);
        setProductos(productosData || []);
      } else {
        setProductos([]);
      }
    } catch (error) {
      console.error(error);
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectCliente(cliente: ClienteBusqueda) {
    setSelectedCliente(cliente);
    void handleBuscarKardex(cliente);
  }

  function handleVolver() {
    setSelectedCliente(null);
    setProductos([]);
  }

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      {!selectedCliente ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold tracking-tight">Kardex Cliente</h1>
          </div>

          <div className="sticky top-16 md:top-20 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                type="text"
                placeholder="Buscar cliente por nombre o código..."
                className="pl-10 h-12 text-base shadow-sm border-zinc-300 dark:border-zinc-700 focus-visible:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {searching && hasSearch ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-36 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
              ))}
            </div>
          ) : !hasSearch ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <p className="text-zinc-500 font-medium">Busca un cliente</p>
              <p className="text-zinc-400 text-sm">Ingresa al menos 2 caracteres para ver resultados</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              No se encontraron clientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-12">
              {clientes.map((cliente) => {
                const rut = cliente.rutclien
                  ? formatRut(`${cliente.rutclien}${cliente.digiveri || ''}`)
                  : 'Sin RUT';

                return (
                  <button
                    key={cliente.kcodclie}
                    type="button"
                    onClick={() => handleSelectCliente(cliente)}
                    className="text-left rounded-xl border border-border bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 shadow-sm transition-all hover:shadow-md p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold text-foreground">{cliente.nombress}</h2>
                        <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                          {cliente.kcodclie}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500">{rut}</p>
                      <p className="text-sm text-zinc-500">{cliente.ciudad || 'Sin ciudad'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <Button type="button" variant="outline" className="w-fit" onClick={handleVolver}>
                    ← Volver
                  </Button>

                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    {selectedCliente.foto_url && !clientPhotoError ? (
                      <img
                        src={selectedCliente.foto_url}
                        alt={selectedCliente.nombress}
                        className="w-full h-full object-cover"
                        onError={() => setClientPhotoError(true)}
                      />
                    ) : (
                      <span className="text-3xl text-zinc-400">👤</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-extrabold tracking-tight">{selectedCliente.nombress}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tipoCliente === 'factura'}
                          onChange={e => setTipoCliente(e.target.checked ? 'factura' : 'comprador')}
                          className="w-4 h-4 rounded"
                        />
                        Buscar como Cliente Factura
                      </label>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {selectedCliente.rutclien
                        ? formatRut(`${selectedCliente.rutclien}${selectedCliente.digiveri || ''}`)
                        : 'Sin RUT'}
                    </p>
                    <p className="text-sm text-zinc-500">{selectedCliente.celular || 'Sin teléfono'}</p>
                    <p className="text-sm text-zinc-500">{selectedCliente.ciudad || 'Sin ciudad'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-36 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
              ))}
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              No hay compras del cliente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
              {productos.map((producto) => {
                const empresaId = producto.empresa_id ?? vidaEmpresaId;
                const empresaSlug = empresaSlugById(empresaId);
                const empresaBadge =
                  empresaId === 1
                    ? { label: 'SANJH', color: 'bg-amber-100 text-amber-700' }
                    : { label: 'VIDA DIGITAL', color: 'bg-teal-100 text-teal-700' };
                const saldoZofri = formatSaldo(producto.saldo_zofri, producto.cantcaja);
                const saldoBodega = formatSaldo(producto.saldo_bodega, producto.cantcaja);
                const tieneSaldoZofri = Number(producto.saldo_zofri ?? 0) > 0;

                return (
                  <div
                    key={producto.codigo}
                    className={cn(
                      'group relative bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-border shadow-sm rounded-xl overflow-hidden transition-all hover:shadow-md border-l-4',
                      tieneSaldoZofri ? 'border-l-emerald-500' : 'border-l-red-500'
                    )}
                  >
                    <div className="flex flex-col p-3 gap-3">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border">
                          <ImageWithFallback
                            src={producto.imagen_url}
                            codigo={producto.codigo}
                            empresaSlug={empresaSlug}
                            fill
                          />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                              {producto.codigo}
                            </span>
                            <Badge className={`text-[10px] px-1.5 py-0 h-4 ${empresaBadge.color}`}>
                              {empresaBadge.label}
                            </Badge>
                          </div>
                          <h3
                            className="text-sm font-medium leading-snug text-foreground line-clamp-3"
                            title={producto.detalle || ''}
                          >
                            {producto.detalle || 'Sin descripción'}
                          </h3>
                        </div>
                      </div>

                      <div className="border-t border-border" />

                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium mb-0.5">
                              Mínimo
                            </div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatUSD(producto.precio_min)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium mb-0.5">
                              Máximo
                            </div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatUSD(producto.precio_max)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium mb-0.5">
                              Último
                            </div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatUSD(producto.precio_ultimo)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium">
                                Saldo Zofri
                              </div>
                              <div className={cn('font-semibold', tieneSaldoZofri ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400')}>
                                {saldoZofri.unidades} unidades
                              </div>
                            </div>
                            <div className="text-right text-zinc-500">
                              {saldoZofri.cajas} cajas
                            </div>
                          </div>

                          {producto.saldo_bodega !== null && producto.saldo_bodega !== undefined && (
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium">
                                  Saldo Bodega
                                </div>
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  {saldoBodega.unidades} unidades
                                </div>
                              </div>
                              <div className="text-right text-zinc-500">
                                {saldoBodega.cajas} cajas
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
