'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { parseImportWorkbook } from './parser';

export function ImportarClient({ 
  lastSyncSanjh, 
  lastSyncVida 
}: { 
  lastSyncSanjh: Date | null; 
  lastSyncVida: Date | null; 
}) {
  const router = useRouter();

  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ sanjh: number; vida: number } | null>(null);
  const [stats, setStats] = useState({ total: 0, valid: 0, error: 0 });
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      let result;
      try {
        result = parseImportWorkbook(workbook);
      } catch (err: any) {
        toast.error(err.message || 'Error procesando el Excel');
        return;
      }

      const products = result.products;
      let valid = 0;
      let error = 0;
      for (const p of products) {
        if (p._valid) valid++; else error++;
      }

      setEmpresaNombre(result.empresaNombre);
      setParsedData(products);
      setStats({ total: products.length, valid, error });
      toast.success(`${valid} productos parseados correctamente`);

    } catch (err: any) {
      toast.error(err.message || 'Error procesando el Excel');
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleUpload = async () => {
    const validProducts = parsedData.filter(p => p._valid);
    if (validProducts.length === 0) return toast.info('No hay productos válidos para subir');
    if (!empresaNombre) return toast.error('No se pudo detectar la empresa desde el archivo');

    setIsUploading(true);
    setImportProgress(0);
    try {
      console.log('Sending empresaNombre:', empresaNombre);

      const CHUNK_SIZE = 200;
      let totalUpserted = 0;

      for (let i = 0; i < validProducts.length; i += CHUNK_SIZE) {
        const chunk = validProducts.slice(i, i + CHUNK_SIZE);
        setImportProgress(i + chunk.length);

        const res = await fetch('/api/admin/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresaNombre, products: chunk })
        });

        if (!res.ok) {
          const errBody = await res.json();
          throw new Error(`Error en bloque ${Math.floor(i/CHUNK_SIZE) + 1}: ${errBody.error || 'Fallo servidor'}`);
        }

        const { count } = await res.json();
        totalUpserted += count;
      }

      setImportProgress(validProducts.length);
      toast.success(`${totalUpserted} productos sincronizados con éxito`);
      router.refresh();
      setParsedData([]);
      setEmpresaNombre(null);
    } catch (err: any) {
      toast.error(err.message || 'Fallo de subida. Revise su conexión.');
    } finally {
      setIsUploading(false);
      setImportProgress(null);
    }
  };

  const handleSyncWinfac = async () => {
    setIsSyncing(true);
    try {
      // Paso 1: disparar script en PC del jefe y esperar que termine
      const triggerRes = await fetch('/api/admin/trigger-sync', { method: 'POST' });

      if (!triggerRes.ok) {
        const triggerBody = await triggerRes.json();
        if (triggerRes.status === 504) {
          toast.error('El PC de sincronización no respondió. Verifica que esté encendido.');
        } else {
          toast.error(triggerBody.error || 'Error al disparar sincronización');
        }
        return;
      }

      // Paso 2: script terminó, ahora actualizar public.productos
      const res = await fetch('/api/admin/sync-from-winfac', { method: 'POST' });
      const body = await res.json();
      if (res.ok) {
        toast.success(`Sincronización exitosa — SANJH: ${body.sanjh_count} productos, VIDA DIGITAL: ${body.vida_count} productos`);
        setSyncResult({ sanjh: body.sanjh_count, vida: body.vida_count });
        router.refresh();
      } else {
        toast.error(body.error || 'Error al sincronizar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600" /> Sincronización Maestra
          </h1>
          <p className="text-zinc-500 mt-1">Importa precios y stock desde WinFac vía Excel</p>
        </div>
        {parsedData.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setParsedData([]); setEmpresaNombre(null); }} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || stats.valid === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando... {importProgress !== null ? importProgress : 0}/{stats.valid}</>
              ) : (
                'Confirmar e Importar DB'
              )}
            </Button>
          </div>
        )}
      </div>

      {parsedData.length === 0 ? (
        <div className="max-w-2xl mx-auto w-full mt-10">
          <div className="max-w-2xl mx-auto w-full mb-6">
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900 p-5 rounded-xl flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 text-base">
                    Sincronización Automática desde WinFac
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Actualiza precios y stock directamente desde los DBFs de WinFac vía Neon. Corre automáticamente todos los días a las 10:30 AM.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <Button
                    onClick={handleSyncWinfac}
                    disabled={isSyncing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSyncing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sincronizando...</> : 'Sincronizar ahora'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900 rounded-lg p-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">SANJH</p>
                  {syncResult ? (
                    <p className="text-sm font-bold text-emerald-700">{syncResult.sanjh} productos actualizados</p>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Última sync: {lastSyncSanjh ? format(new Date(lastSyncSanjh), "dd MMM yyyy, HH:mm", { locale: es }) : 'Sin datos'}
                    </p>
                  )}
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900 rounded-lg p-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">VIDA DIGITAL</p>
                  {syncResult ? (
                    <p className="text-sm font-bold text-emerald-700">{syncResult.vida} productos actualizados</p>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Última sync: {lastSyncVida ? format(new Date(lastSyncVida), "dd MMM yyyy, HH:mm", { locale: es }) : 'Sin datos'}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">o importa manualmente por Excel</span>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <label className="flex flex-col items-center justify-center w-full h-80 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl cursor-pointer transition-colors group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              {isParsing ? (
                <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mb-4" />
              ) : (
                <UploadCloud className="w-16 h-16 text-zinc-400 group-hover:text-emerald-500 transition-colors mb-4" />
              )}
              <p className="mb-2 text-xl font-bold text-zinc-700 dark:text-zinc-300">
                {isParsing ? 'Analizando documento...' : 'Haz clic para subir archivo Excel (.xlsx, .xls)'}
              </p>
              <p className="text-sm text-zinc-500">
                La empresa se detecta automáticamente desde la celda A2 del archivo.
              </p>
            </div>
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} disabled={isParsing} />
          </label>
        </div>

      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-500">Total Detectados</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 p-4 rounded-xl border flex items-center justify-between col-span-1 md:col-span-1">
              <div className="text-sm font-medium text-blue-700">Empresa Detectada</div>
              <Badge className="text-xs bg-blue-600 text-white">{empresaNombre || 'No detectada'}</Badge>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 p-4 rounded-xl border flex items-center justify-between">
              <div className="text-sm font-medium text-emerald-700">Listos para Subir</div>
              <div className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> {stats.valid}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 border-red-200 p-4 rounded-xl border flex items-center justify-between">
              <div className="text-sm font-medium text-red-700">Con Errores (Ignorados)</div>
              <div className="text-2xl font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> {stats.error}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 p-4 rounded-xl">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Tips de Importación
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>La empresa se detecta automáticamente desde la celda <code>A2</code> del Excel.</li>
              <li>Columnas requeridas en la fila 5: <code>CODIGO, DETALLE, PRCVENTA, PRCMINIMO, COSTO, CIF, SALDO, NROINGRESO, UMED, CANTCAJA, PESOCAJA, CUBICAJA</code>.</li>
              <li>Al importar, los productos existentes se <strong>actualizarán</strong> y los nuevos se <strong>crearán</strong>.</li>
              <li>Los productos nuevos ingresarán automáticamente marcados con la etiqueta "NUEVO".</li>
            </ul>
          </div>

          <div className="border rounded-xl bg-white dark:bg-zinc-950 shadow-sm overflow-hidden flex-1 overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900 border-b">
                <TableRow>
                  <TableHead className="w-16">Est</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Venta ($)</TableHead>
                  <TableHead className="text-right">Stock Sis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.slice(0, 100).map((row, i) => (
                  <TableRow key={i} className={!row._valid ? "bg-red-50/50" : ""}>
                    <TableCell>
                      {row._valid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.codigo || '-'}</TableCell>
                    <TableCell className="text-xs truncate max-w-xs">{row.detalle || '-'}</TableCell>
                    <TableCell className="text-right text-sm">{(row.prcventa || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{row.saldo || 0}</TableCell>
                  </TableRow>
                ))}
                {parsedData.length > 100 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-zinc-500 italic bg-zinc-50 dark:bg-zinc-900 text-sm">
                      Mostrando 100 de {parsedData.length} registros...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
