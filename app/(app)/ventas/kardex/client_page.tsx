'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Search, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { cn, formatRut, formatUSD } from '@/lib/utils';
import { useShareImage } from '@/hooks/useShareImage';
import { ProductDrawer } from '@/components/ProductDrawer';
import { Producto } from '@/types';

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
  costo?: number | null;
  saldo_zofri?: number | null;
  saldo_bodega?: number | null;
  cantcaja?: number | null;
  compras?: Array<{ fecha: string; precio: number; nvta: string; cantidad: number; empresa_id: number }>;
};

type KardexGeneral = {
  precio_minimo: number | null;
  precio_maximo: number | null;
  precio_medio: number | null;
  precio_medio_status: string;
  total_ventas: number;
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
  const { shareImage } = useShareImage();
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [clientes, setClientes] = useState<ClienteBusqueda[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteBusqueda | null>(null);
  const [productos, setProductos] = useState<KardexProducto[]>([]);
  const [kardexMap, setKardexMap] = useState<Record<string, KardexGeneral>>({});
  const [tipoCliente, setTipoCliente] = useState<'comprador' | 'factura'>('comprador');
  const [loading, setLoading] = useState(false);
  const [clientPhotoError, setClientPhotoError] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchDebounced, setProductSearchDebounced] = useState('');
  const [productResults, setProductResults] = useState<Producto[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<Producto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtroKardex, setFiltroKardex] = useState('');

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
    const timer = setTimeout(() => setProductSearchDebounced(productSearch), 400);
    return () => clearTimeout(timer);
  }, [productSearch]);

  useEffect(() => {
    if (productSearchDebounced.trim().length < 2) {
      setProductResults([]);
      return;
    }
    setProductSearching(true);
    fetch(`/api/productos?search=${encodeURIComponent(productSearchDebounced.trim())}`)
      .then(res => res.ok ? res.json() : { data: [] })
      .then(({ data }) => setProductResults(data || []))
      .catch(() => setProductResults([]))
      .finally(() => setProductSearching(false));
  }, [productSearchDebounced]);

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
        void fetchKardexGenerales(productosData || []);
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

  async function fetchKardexGenerales(prods: KardexProducto[]) {
    const codigos = [...new Set(prods.map((p) => p.codigo))];
    const results = await Promise.allSettled(
      codigos.map(async (codigo) => {
        const res = await fetch(
          `/api/kardex?codigo=${encodeURIComponent(codigo)}&empresaSlug=vida`
        );
        if (!res.ok) return null;
        const data = await res.json();
        return { codigo, data };
      })
    );
    const map: Record<string, KardexGeneral> = {};
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        map[r.value.codigo] = r.value.data;
      }
    }
    setKardexMap(map);
  }

  function handleSelectCliente(cliente: ClienteBusqueda) {
    setFiltroKardex('');
    setSelectedCliente(cliente);
    void handleBuscarKardex(cliente);
  }

  function handleVolver() {
    setFiltroKardex('');
    setSelectedCliente(null);
    setProductos([]);
  }

  async function handleFotoCliente(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedCliente) return;
    setUploadingFoto(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const empresaId = vidaEmpresaId;
      const res = await fetch(
        `/api/ventas/clientes/${selectedCliente.kcodclie}/foto`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, empresaId }),
        }
      );
      if (!res.ok) throw new Error('Error subiendo foto');
      const { imagen_url } = await res.json();
      setSelectedCliente(prev => prev ? { ...prev, foto_url: imagen_url } : prev);
      setClientPhotoError(false);
    } catch {
      // toast error silencioso
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  }

  const productosFiltrados = filtroKardex.trim().length >= 1
    ? productos.filter(p =>
        p.codigo.toLowerCase().includes(filtroKardex.toLowerCase()) ||
        (p.detalle || '').toLowerCase().includes(filtroKardex.toLowerCase())
      )
    : productos;

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

                  <div className="relative w-24 h-24 flex-shrink-0">
                    <div
                      className="w-full h-full rounded-xl overflow-hidden border border-border bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center cursor-pointer"
                      onClick={() => fotoInputRef.current?.click()}
                    >
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
                    <button
                      type="button"
                      onClick={() => fotoInputRef.current?.click()}
                      disabled={uploadingFoto}
                      className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1.5 shadow-md transition-colors"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                    <input
                      ref={fotoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFotoCliente}
                    />
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
                    <div className="relative mt-2 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <Input
                        type="text"
                        placeholder="Buscar producto..."
                        className="pl-9 h-9 text-sm"
                        value={productSearch}
                        onChange={e => {
                          setProductSearch(e.target.value);
                          if (!e.target.value) setProductResults([]);
                        }}
                      />
                      {productResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                          {productResults.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setDrawerProduct(p);
                                setDrawerOpen(true);
                                setProductSearch('');
                                setProductResults([]);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 border-b last:border-b-0 border-border"
                            >
                              <span className="font-mono text-xs text-zinc-500 shrink-0">{p.codigo}</span>
                              <span className="text-sm truncate">{p.detalle}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative mt-2 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <Input
                        type="text"
                        placeholder="Filtrar en kardex..."
                        className="pl-9 h-9 text-sm"
                        value={filtroKardex}
                        onChange={e => setFiltroKardex(e.target.value)}
                      />
                      {filtroKardex && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                          {productosFiltrados.length}
                        </span>
                      )}
                    </div>
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
          ) : productosFiltrados.length === 0 && filtroKardex ? (
            <div className="text-center py-12 text-zinc-500">
              No se encontró "{filtroKardex}" en el kardex de este cliente.
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              No hay compras del cliente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
              {productosFiltrados.map((producto) => {
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
                        <div className="flex-shrink-0 w-28 h-28 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border">
                          <ImageWithFallback
                            src={producto.imagen_url}
                            codigo={producto.codigo}
                            empresaSlug={empresaSlug}
                            fill
                          />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-sm font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                              {producto.codigo}
                            </span>
                            <Badge className={`text-xs px-1.5 py-0 h-4 ${empresaBadge.color}`}>
                              {empresaBadge.label}
                            </Badge>
                            {producto.imagen_url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  shareImage(producto.imagen_url!, `${producto.codigo}.jpg`, producto.detalle);
                                }}
                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                              >
                                <Share2 className="w-3 h-3 text-zinc-400" />
                              </button>
                            )}
                          </div>
                          <h3
                            className="text-base font-medium leading-snug text-foreground line-clamp-3"
                            title={producto.detalle || ''}
                          >
                            {producto.detalle || 'Sin descripción'}
                          </h3>
                          {producto.cantcaja && producto.cantcaja > 1 && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Packing: {producto.cantcaja} u/caja
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-border" />

                      <div className="grid grid-cols-1 gap-3">
                        {/* MERCADO */}
                        <div className="text-sm">
                          <div className="text-xs uppercase tracking-wide text-zinc-400 font-medium mb-1">Se ha vendido</div>
                          {(() => {
                            const km = kardexMap[producto.codigo];
                            if (!km) return <span className="text-xs text-zinc-400">...</span>;
                            return (
                              <div className="flex gap-4">
                                <div>
                                  <div className="text-xs text-zinc-400">Mínimo</div>
                                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">{km.precio_minimo != null ? formatUSD(km.precio_minimo) : '—'}</div>
                                </div>
                                {km.precio_medio_status === 'ok' && km.precio_medio != null && (
                                  <div>
                                    <div className="text-xs text-zinc-400">Medio</div>
                                    <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">{formatUSD(km.precio_medio)}</div>
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs text-zinc-400">Máximo</div>
                                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">{km.precio_maximo != null ? formatUSD(km.precio_maximo) : '—'}</div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* COMPRÓ */}
                        <div className="text-sm">
                          <div className="text-xs uppercase tracking-wide text-zinc-400 font-medium mb-1">Compró</div>
                          {(() => {
                            const comprasArr = (producto.compras || []) as Array<{ fecha: string; precio: number; cantidad: number }>;
                            const uniqueByPrecio = Object.values(
                              comprasArr.reduce((acc: Record<string, { fecha: string; precio: number; cantidad: number }>, c) => {
                                const key = String(c.precio);
                                if (!acc[key] || new Date(c.fecha) > new Date(acc[key].fecha)) {
                                  acc[key] = { fecha: c.fecha, precio: c.precio, cantidad: Number(c.cantidad) };
                                }
                                return acc;
                              }, {})
                            )
                              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                              .slice(0, 3);
                            return uniqueByPrecio.map((c) => {
                              const cajas = producto.cantcaja && producto.cantcaja > 0
                                ? Math.floor(c.cantidad / producto.cantcaja)
                                : null;
                              return (
                                <div key={c.precio} className="flex items-center justify-between">
                                  <span className="text-sm text-zinc-400">{format(new Date(c.fecha), 'dd MMM yyyy', { locale: es })}</span>
                                  <div className="text-right">
                                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{formatUSD(c.precio)}</span>
                                    {cajas !== null
                                      ? <span className="text-sm text-zinc-400 ml-1">({cajas} cajas)</span>
                                      : <span className="text-sm text-zinc-400 ml-1">({c.cantidad} uds)</span>
                                    }
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* COSTO */}
                        {producto.costo != null && (
                          <div className="text-sm flex items-center justify-between">
                            <div className="text-xs uppercase tracking-wide text-zinc-400 font-medium">Costo</div>
                            <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">{formatUSD(producto.costo)}</div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-zinc-400 font-medium">
                                Saldo Zofri
                              </div>
                              <div className={cn('text-base font-bold', tieneSaldoZofri ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400')}>
                                {saldoZofri.unidades} unidades
                              </div>
                            </div>
                            <div className="text-right text-sm text-zinc-500">
                              {saldoZofri.cajas} cajas
                            </div>
                          </div>

                          {producto.saldo_bodega !== null && producto.saldo_bodega !== undefined && (
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400 font-medium">
                                  Saldo Bodega
                                </div>
                                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                                  {saldoBodega.unidades} unidades
                                </div>
                              </div>
                              <div className="text-right text-sm text-zinc-500">
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

      <ProductDrawer
        producto={drawerProduct}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        session={session}
        empresaNombre={(drawerProduct as any)?.nombre_empresa || ''}
        onUpdated={(updated) => setDrawerProduct(updated)}
      />
    </div>
  );
}
