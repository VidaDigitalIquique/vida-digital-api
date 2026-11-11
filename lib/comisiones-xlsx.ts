import * as XLSX from 'xlsx';
import type { InformeComisiones } from '@/lib/comisiones-utils';

const ENCABEZADOS = ['Vendedor', 'Notas facturadas', 'Total vendido USD', '% comisión', 'Comisión USD'];
const MONEDA = '"$"#,##0.00';
// Formato literal: el valor de la API es 0.5 (0,5 %), no la fraccion 0.005.
const PORCENTAJE = '0.00"%"';

/** Hoja del informe ya calculado (mismas filas y totales que la pantalla). */
export function generarComisionesXlsx(informe: InformeComisiones): Buffer {
  const filas: (string | number)[][] = [
    ENCABEZADOS,
    ...informe.filas.map((f) => [f.vendedor, f.notas, f.total_usd, f.comision_pct, f.comision_usd]),
    ['TOTAL', informe.totales.notas, informe.totales.total_usd, informe.comision_pct, informe.totales.comision_usd],
  ];
  const ws = XLSX.utils.aoa_to_sheet(filas);

  const totales = informe.filas.length + 2;
  for (let r = 2; r <= totales; r++) {
    const nombre = ws[`A${r}`];
    if (nombre) {
      // Frontera de confianza: un nombre que empieza con "=" debe quedar como texto.
      delete (nombre as { f?: string }).f;
      nombre.t = 's';
    }
    if (ws[`B${r}`]) ws[`B${r}`].z = '0';
    if (ws[`C${r}`]) ws[`C${r}`].z = MONEDA;
    if (ws[`D${r}`]) ws[`D${r}`].z = PORCENTAJE;
    if (ws[`E${r}`]) ws[`E${r}`].z = MONEDA;
  }
  ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, informe.mes_etiqueta);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
