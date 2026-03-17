'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function ImportarClient() {
  const [activeEmpresaId, setActiveEmpresaId] = useState<number>(0);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Sync with localStorage
  useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vidadigital_empresa');
      if (stored && !isNaN(parseInt(stored, 10))) {
        setActiveEmpresaId(parseInt(stored, 10));
      }
    }
  });

  // Listen for changes
  useState(() => {
    if (typeof window !== 'undefined') {
      const handleStorage = () => {
        const stored = localStorage.getItem('vidadigital_empresa');
        if (stored && !isNaN(parseInt(stored, 10))) {
          setActiveEmpresaId(parseInt(stored, 10));
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
  });
  
  const [stats, setStats] = useState({ total: 0, valid: 0, error: 0 });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Parse as raw JSON arrays first to identify columns
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (rawData.length <= 4) throw new Error('El archivo debe tener al menos 5 filas (título, empresa, fecha, vacío, encabezados).');

      const headers = (rawData[4] as string[]).map(h => (h || '').toString().trim().toUpperCase());
      
      // Strict mapping as per request
      const idxCodigo = headers.indexOf('CODIGO');
      const idxDetalle = headers.indexOf('DETALLE');
      const idxPrcVenta = headers.indexOf('PRCVENTA');
      const idxPrcMinimo = headers.indexOf('PRCMINIMO');
      const idxCosto = headers.indexOf('COSTO');
      const idxCif = headers.indexOf('CIF');
      const idxSaldo = headers.indexOf('SALDO');
      const idxNroIngreso = headers.indexOf('NROINGRESO');
      const idxUmed = headers.indexOf('UMED');
      const idxCantCaja = headers.indexOf('CANTCAJA');
      const idxPesoCaja = headers.indexOf('PESOCAJA');
      const idxCubiCaja = headers.indexOf('CUBICAJA');

      if (idxCodigo === -1 || idxDetalle === -1) {
         throw new Error('El Excel debe contener los encabezados "CODIGO" y "DETALLE" exactamente en la fila 5 (índice 4).');
      }

      const products = [];
      let valid = 0;
      let error = 0;

      for (let i = 5; i < rawData.length; i++) {
         const row = rawData[i];
         if (!row || row.length === 0 || !row[idxCodigo]) continue; // Skip empty rows

         const p = {
           codigo: String(row[idxCodigo] || '').trim(),
           detalle: String(row[idxDetalle] || ''),
           prcventa: idxPrcVenta !== -1 ? parseFloat(row[idxPrcVenta]) : 0,
           prcminimo: idxPrcMinimo !== -1 ? parseFloat(row[idxPrcMinimo]) : 0,
           costo: idxCosto !== -1 ? parseFloat(row[idxCosto]) : 0,
           cif: idxCif !== -1 ? parseFloat(row[idxCif]) : 0,
           saldo: idxSaldo !== -1 ? parseFloat(row[idxSaldo]) : 0,
           nroingreso: idxNroIngreso !== -1 ? String(row[idxNroIngreso] || '') : '',
           umed: idxUmed !== -1 ? String(row[idxUmed] || '') : 'UN',
           cantcaja: idxCantCaja !== -1 ? parseFloat(row[idxCantCaja]) : 1,
           pesocaja: idxPesoCaja !== -1 ? parseFloat(row[idxPesoCaja]) : 0,
           cubicaja: idxCubiCaja !== -1 ? parseFloat(row[idxCubiCaja]) : 0,
         };

         // Basic validation
         const isValid = p.codigo.length > 0;
         if (isValid) valid++; else error++;

         products.push({ ...p, _valid: isValid });
      }

      setParsedData(products);
      setStats({ total: products.length, valid, error });
      toast.success(`${valid} productos parseados correctamente`);

    } catch (err: any) {
      toast.error(err.message || 'Error procesando el Excel');
    } finally {
      setIsParsing(false);
      // Reset input logic allows selecting same file again
      e.target.value = '';
    }
  };

  const handleUpload = async () => {
    const validProducts = parsedData.filter(p => p._valid);
    if (validProducts.length === 0) return toast.info('No hay productos válidos para subir');

    setIsUploading(true);
    setImportProgress(0);
    try {
      console.log('activeEmpresaId prop/state:', activeEmpresaId);
      console.log('localStorage value:', typeof window !== 'undefined' ? localStorage.getItem('vidadigital_empresa') : 'n/a');

      let finalEmpresaId = activeEmpresaId;
      if ((!finalEmpresaId || finalEmpresaId === 0) && typeof window !== 'undefined') {
        const stored = localStorage.getItem('vidadigital_empresa');
        if (stored && !isNaN(parseInt(stored, 10))) {
          finalEmpresaId = parseInt(stored, 10);
        }
      }
      console.log('Sending empresaId:', finalEmpresaId, 'from slug:', typeof window !== 'undefined' ? localStorage.getItem('vidadigital_empresa') : 'N/A');

      const CHUNK_SIZE = 200;
      let totalUpserted = 0;

      for (let i = 0; i < validProducts.length; i += CHUNK_SIZE) {
         const chunk = validProducts.slice(i, i + CHUNK_SIZE);
         setImportProgress(i + chunk.length);

         const res = await fetch('/api/admin/importar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              empresaId: finalEmpresaId,
              products: chunk
            })
         });

         if (!res.ok) {
            const errBody = await res.json();
            console.log('Chunk error:', errBody);
            throw new Error(`Error en bloque ${Math.floor(i/CHUNK_SIZE) + 1}: ${errBody.error || 'Fallo servidor'}`);
         }
         
         const { count } = await res.json();
         totalUpserted += count;
      }

      setImportProgress(validProducts.length);
      toast.success(`${totalUpserted} productos sincronizados con éxito`);
      setParsedData([]); // clear on success
    } catch (err: any) {
       toast.error(err.message || 'Fallo de subida. Revise su conexión.');
    } finally {
       setIsUploading(false);
       setImportProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
             <FileSpreadsheet className="w-8 h-8 text-emerald-600" /> Sincronización Maestra
          </h1>
          <p className="text-zinc-500 mt-1">Importa precios y stock desde ERP Softland u otros sistemas vía Excel</p>
        </div>
        {parsedData.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setParsedData([])} disabled={isUploading}>
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
                   El archivo debe contener <span className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1 rounded">CODIGO</span> y <span className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1 rounded">DETALLE</span> en la fila 5.
                 </p>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} disabled={isParsing} />
           </label>

           <div className="mt-8 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 p-4 rounded-xl">
              <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4" /> Tips de Importación
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                 <li>Columnas requeridas en la fila 5: <code>CODIGO, DETALLE, PRCVENTA, PRCMINIMO, COSTO, CIF, SALDO, NROINGRESO, UMED, CANTCAJA, PESOCAJA, CUBICAJA</code>.</li>
                 <li>Al importar, los productos existentes se <strong>actualizarán</strong> y los nuevos se <strong>crearán</strong>.</li>
                 <li>Los productos nuevos ingresarán automáticamente marcados con la etiqueta "NUEVO".</li>
                 <li>El <code>saldo</code> actual en Bodegas no se sobreescribe desde aquí; solo el Saldo Sistema Global.</li>
              </ul>
           </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
           {/* Stats summary */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border flex items-center justify-between">
                 <div className="text-sm font-medium text-zinc-500">Total Detectados</div>
                 <div className="text-2xl font-bold">{stats.total}</div>
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

           {/* Preview Table */}
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
