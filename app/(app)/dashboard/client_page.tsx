'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Package, CheckCircle2, AlertTriangle, Clock, Truck, PlusCircle } from "lucide-react";
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

export function DashboardClient({ stats, stockCompare, despachosHoyCount, ultimoDia, penultimoDia }: {
  stats: Record<number, any>;
  stockCompare: StockCompareRow[];
  despachosHoyCount: number;
  ultimoDia: { fecha: string; count: number } | null;
  penultimoDia: { fecha: string; count: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerRows, setDrawerRows] = useState<StockDetailRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Resumen General</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Métricas principales en tiempo real.</p>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-screen h-screen sm:w-[500px] sm:h-full max-w-full overflow-y-auto flex flex-col p-0">
          <div className="p-5 flex flex-col h-full overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{drawerTitle}</SheetTitle>
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
          </div>
        </SheetContent>
      </Sheet>

      {/* ── MÉTRICAS POR EMPRESA ── */}
      {Object.entries(stats).map(([empId, s]) => {
        const empInfo = stockCompare.find(e => e.empresaId === Number(empId));
        const empNombre = empInfo?.nombre || `Empresa ${empId}`;
        const empShort = empNombre.includes('SANJH') ? 'SANJH' : 'VIDA DIGITAL';

        return (
          <div key={empId}>
            <h2 className="text-lg font-bold mb-3">{empShort}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-zinc-500">Total Productos</CardTitle>
                  <Package className="w-4 h-4 text-zinc-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{s.totalProds}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-zinc-500">Con Stock</CardTitle>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{s.inStock}</div>
                </CardContent>
              </Card>

              <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-green-700 dark:text-green-400">Nuevos</CardTitle>
                  <PlusCircle className="w-4 h-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{s.nuevos}</div>
                </CardContent>
              </Card>

              <Card className={s.sinPrecio > 0 ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/20" : ""}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className={`text-xs font-medium ${s.sinPrecio > 0 ? 'text-red-600 font-semibold' : 'text-zinc-500'}`}>
                    Sin Precio
                  </CardTitle>
                  <AlertTriangle className={`w-4 h-4 ${s.sinPrecio > 0 ? 'text-red-500' : 'text-zinc-400'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${s.sinPrecio > 0 ? 'text-red-600' : ''}`}>
                    {s.sinPrecio}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-zinc-500">Última Importación</CardTitle>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {s.lastImport ? format(new Date(s.lastImport), "dd MMM yyyy, HH:mm", { locale: es }) : 'Nunca'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })}

      {/* ── DESPACHOS HOY ── */}
      <div className="border rounded-xl p-5 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-zinc-500" />
          <h2 className="text-lg font-bold">Despachos de Bodega</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 border ${despachosHoyCount > 0
            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'}`}>
            <p className="text-xs uppercase tracking-wide font-medium text-zinc-500 mb-1">Hoy</p>
            <p className={`text-4xl font-black ${despachosHoyCount > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-500 dark:text-amber-400'}`}>
              {despachosHoyCount}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              {despachosHoyCount > 0
                ? `despacho${despachosHoyCount > 1 ? 's' : ''} registrado${despachosHoyCount > 1 ? 's' : ''}`
                : 'sin despachos aún'}
            </p>
          </div>

          <div className="rounded-xl p-4 border bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-wide font-medium text-zinc-500 mb-1">
              Último día activo
            </p>
            {ultimoDia ? (
              <>
                <p className="text-4xl font-black text-zinc-700 dark:text-zinc-200">
                  {ultimoDia.count}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {format(new Date(ultimoDia.fecha), "dd MMM yyyy", { locale: es })}
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-400 mt-2">Sin datos</p>
            )}
          </div>
        </div>
      </div>

      {/* ── COMPARACIÓN DE STOCK (secundario) ── */}
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
    </div>
  );
}
