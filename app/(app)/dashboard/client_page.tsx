'use client';

import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle2, AlertTriangle, Clock, Truck, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type StockCompareRow = {
  empresaId: number;
  nombre: string;
  saldoZofriTotal: number;
  fisicoTotal: number | null;
};

export function DashboardClient({ stats, stockCompare }: { stats: Record<number, any>; stockCompare: StockCompareRow[] }) {
  const { empresaId, isLoaded } = useEmpresaId();
  
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

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold">Comparación de Stock</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Totales de Zofri vs físico por empresa.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stockCompare.map(row => {
            const hasFisico = row.fisicoTotal !== null;
            const diferencia = hasFisico ? row.fisicoTotal! - row.saldoZofriTotal : null;
            const diffColor =
              diferencia === null || diferencia === 0
                ? 'text-zinc-500'
                : diferencia > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400';
            const diffLabel =
              diferencia === null ? '—' : diferencia > 0 ? `+${diferencia}` : `${diferencia}`;

            return (
              <Card key={row.empresaId} className="border-zinc-200/70 dark:border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold">{row.nombre}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">Saldo Zofri total</span>
                    <span className="text-2xl font-bold">{row.saldoZofriTotal}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">Físico total</span>
                    <span className="text-2xl font-bold">{hasFisico ? row.fisicoTotal : '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">Diferencia</span>
                    <span className={`text-2xl font-bold ${diffColor}`}>{diffLabel}</span>
                  </div>
                </CardContent>
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
