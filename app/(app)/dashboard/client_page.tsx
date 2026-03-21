'use client';

import { useState } from "react";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Package, CheckCircle2, AlertTriangle, Clock, Truck, PlusCircle, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type StockCompareRow = {
  empresaId: number;
  nombre: string;
  saldoZofriTotal: number;
  fisicoTotal: number | null;
  conSobrante: number;
  conFaltante: number;
  sinFisico: number;
  totalConFisico: number;
};

type StockDetailRow = {
  codigo: string;
  detalle: string | null;
  saldo: number;
  fisico: number;
  diferencia: number;
};

export function DashboardClient({ stats, stockCompare }: { stats: Record<number, any>; stockCompare: StockCompareRow[] }) {
  const { empresaId, isLoaded } = useEmpresaId();
  const [open, setOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerRows, setDrawerRows] = useState<StockDetailRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  if (!isLoaded || !empresaId || !stats[empresaId]) return null;

  const currentStats = stats[empresaId];

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Resumen General</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Métricas principales de la empresa en tiempo real.
        </p>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full h-full sm:max-w-2xl overflow-y-auto flex flex-col">
          <SheetHeader>
            <div className="flex items-center justify-between mb-2">
              <SheetTitle>{drawerTitle}</SheetTitle>
              <SheetClose className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X className="w-5 h-5 text-zinc-500" />
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="mt-6">
            {drawerError ? (
              <div className="text-sm text-red-600">{drawerError}</div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-500">
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-2 font-semibold">Código</th>
                    <th className="text-left py-2 font-semibold">Detalle</th>
                    <th className="text-right py-2 font-semibold">Saldo Zofri</th>
                    <th className="text-right py-2 font-semibold">Físico</th>
                    <th className="text-right py-2 font-semibold">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerLoading ? (
                    <tr>
                      <td className="py-3 text-zinc-500" colSpan={5}>Cargando...</td>
                    </tr>
                  ) : drawerRows.length > 0 ? (
                    drawerRows.map(row => (
                      <tr key={row.codigo} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-2 font-mono">{row.codigo}</td>
                        <td className="py-2">{row.detalle || '—'}</td>
                        <td className="py-2 text-right">{row.saldo}</td>
                        <td className="py-2 text-right">{row.fisico}</td>
                        <td className={`py-2 text-right font-semibold ${row.diferencia >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.diferencia >= 0 ? `+${row.diferencia}` : row.diferencia}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3 text-zinc-500" colSpan={5}>Sin resultados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold">Comparación de Stock</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Totales de Zofri vs físico por empresa.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stockCompare.map(row => {
            const total = row.conSobrante + row.conFaltante + row.sinFisico;
            const sobrantePct = total > 0 ? (row.conSobrante / total) * 100 : 0;
            const faltantePct = total > 0 ? (row.conFaltante / total) * 100 : 0;
            const sinFisicoPct = total > 0 ? (row.sinFisico / total) * 100 : 0;
            const openDrawer = async (tipo: 'sobrante' | 'faltante') => {
              setDrawerTitle(`Productos con ${tipo} — ${row.nombre}`);
              setDrawerRows([]);
              setDrawerError(null);
              setDrawerLoading(true);
              setOpen(true);
              try {
                const res = await fetch(`/api/dashboard/stock-detail?empresaId=${row.empresaId}&tipo=${tipo}`);
                if (!res.ok) throw new Error('No se pudo cargar el detalle.');
                const data = await res.json();
                setDrawerRows(data?.data || []);
              } catch (err: any) {
                setDrawerError(err?.message || 'Error cargando detalle.');
              } finally {
                setDrawerLoading(false);
              }
            };

            return (
              <Card key={row.empresaId} className="border-zinc-200/70 dark:border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold">{row.nombre}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wide text-emerald-600">productos con sobrante</span>
                    <button
                      type="button"
                      className="text-2xl font-bold text-emerald-600 text-left hover:underline"
                      onClick={() => openDrawer('sobrante')}
                    >
                      {row.conSobrante}
                    </button>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wide text-red-600">productos con faltante</span>
                    <button
                      type="button"
                      className="text-2xl font-bold text-red-600 text-left hover:underline"
                      onClick={() => openDrawer('faltante')}
                    >
                      {row.conFaltante}
                    </button>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">productos sin físico</span>
                    <span className="text-2xl font-bold text-zinc-500">{row.sinFisico}</span>
                  </div>
                </CardContent>
                <div className="px-6 pb-4">
                  <div
                    className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                    data-testid={`stock-compare-progress-${row.empresaId}`}
                  >
                    <div
                      className="h-full bg-emerald-500"
                      data-testid="stock-compare-seg-sobrante"
                      style={{ width: `${sobrantePct}%` }}
                    />
                    <div
                      className="h-full bg-red-500"
                      data-testid="stock-compare-seg-faltante"
                      style={{ width: `${faltantePct}%` }}
                    />
                    <div
                      className="h-full bg-zinc-400"
                      data-testid="stock-compare-seg-sin-fisico"
                      style={{ width: `${sinFisicoPct}%` }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Total Productos</CardTitle>
            <Package className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStats.totalProds}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Con Stock {'>'} 0</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStats.inStock}</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400">Productos NUEVOS</CardTitle>
            <PlusCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{currentStats.nuevos}</div>
          </CardContent>
        </Card>

        <Card className={currentStats.sinPrecio > 0 ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/20" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-medium ${currentStats.sinPrecio > 0 ? 'text-red-600 font-semibold' : 'text-zinc-500'}`}>
              Sin Precio (con stock)
            </CardTitle>
            <AlertTriangle className={`w-4 h-4 ${currentStats.sinPrecio > 0 ? 'text-red-500' : 'text-zinc-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${currentStats.sinPrecio > 0 ? 'text-red-600' : ''}`}>
              {currentStats.sinPrecio}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Última Importación</CardTitle>
            <Clock className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {currentStats.lastImport ? format(new Date(currentStats.lastImport), "dd MMM yyyy, HH:mm", { locale: es }) : 'Nunca'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Despachos Hoy</CardTitle>
            <Truck className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStats.despachosHoy}</div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
