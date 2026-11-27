/**
 * Reconciliación manual Cloudinary <-> public.productos.
 *   --dry | --apply --backup <carpeta> | --restaurar <archivo.json>
 */
import { neon } from '@neondatabase/serverless';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { listarImagenesProductos } from '../lib/cloudinary';
import {
  aplicarPlan, planificarReconciliacion, type EjecutorSql, type ProductoFoto, type RecursoFoto,
} from '../lib/fotos-sync';

const MAX_PAGINAS = 50;
export type FilaFoto = { id: number; codigo: string; imagen_url: string | null; public_id: string | null };
export type ResultadoScript = { codigo: number; escribio: boolean; bloqueado: string | null; acciones: number;
  aplicadas?: number; pendientes?: number; errores?: number };
export type DepsScript = {
  listar: () => Promise<{ recursos: RecursoFoto[]; incompleto: boolean }>;
  sql: EjecutorSql;
  log: (linea: string) => void;
  volcar: (filas: FilaFoto[]) => string;
};

export async function listarTodoCloudinary(limite = MAX_PAGINAS) {
  const recursos: RecursoFoto[] = [];
  let cursor: string | null = null;
  for (let paginas = 0; cursor !== null || paginas === 0; paginas++) {
    if (paginas >= limite) break;
    const pagina = await listarImagenesProductos(cursor, 500);
    recursos.push(...pagina.recursos);
    cursor = pagina.siguiente;
  }
  return { recursos, incompleto: Boolean(cursor) };
}

export function volcarRespaldo(filas: FilaFoto[], carpeta: string, fecha = new Date()): string {
  mkdirSync(carpeta, { recursive: true });
  const sello = fecha.toISOString().replace(/\D/g, '').slice(0, 14);
  const ruta = join(carpeta, `fotos-backup-${sello.slice(0, 8)}-${sello.slice(8)}.json`);
  writeFileSync(ruta, JSON.stringify(filas, null, 2), 'utf8');
  return ruta;
}

export async function restaurar(sql: EjecutorSql, filas: FilaFoto[]): Promise<number> {
  for (const f of filas) {
    await sql`UPDATE public.productos SET imagen_url = ${f.imagen_url}, public_id = ${f.public_id},
      updated_at = NOW() WHERE id = ${f.id}`;
  }
  return filas.length;
}

export async function ejecutarReconciliacion(
  deps: DepsScript, opciones: { aplicar: boolean; backup?: string }
): Promise<ResultadoScript> {
  if (opciones.aplicar && !opciones.backup) {
    deps.log('ERROR: --apply requiere --backup <carpeta>. No se escribe nada.');
    return { codigo: 1, escribio: false, bloqueado: null, acciones: 0 };
  }
  const { recursos, incompleto } = await deps.listar();
  const productos = (await deps.sql`SELECT id, codigo, imagen_url, public_id FROM public.productos ORDER BY id`) as ProductoFoto[];
  const plan = planificarReconciliacion(productos, recursos, process.env.CLOUDINARY_CLOUD_NAME ?? '', { listadoIncompleto: incompleto });
  deps.log(JSON.stringify({ bloqueado: plan.bloqueado, conteos: plan.conteos, acciones: plan.acciones.length,
    muestra: plan.acciones.slice(0, 20) }, null, 2));
  if (plan.bloqueado) return { codigo: 1, escribio: false, bloqueado: plan.bloqueado, acciones: 0 };
  if (!opciones.aplicar) {
    deps.log(`DRY-RUN: ${plan.acciones.length} acciones pendientes.`);
    return { codigo: 0, escribio: false, bloqueado: null, acciones: plan.acciones.length };
  }
  const ids = new Set(plan.acciones.map((a) => a.id));
  const afectadas = productos.filter((p) => ids.has(p.id))
    .map(({ id, codigo, imagen_url, public_id }) => ({ id, codigo, imagen_url, public_id }));
  let ruta: string;
  try {
    ruta = deps.volcar(afectadas);
  } catch (error) {
    deps.log(`ERROR: no se pudo escribir el respaldo (${error instanceof Error ? error.message : 'fallo'}); no se aplica.`);
    return { codigo: 1, escribio: false, bloqueado: null, acciones: plan.acciones.length };
  }
  deps.log(`Respaldo: ${ruta}`);
  const resultado = await aplicarPlan(deps.sql, plan);
  deps.log(JSON.stringify(resultado));
  return { codigo: 0, escribio: true, bloqueado: null, acciones: plan.acciones.length, ...resultado };
}

async function main() {
  const args = process.argv.slice(2);
  const sql = neon(process.env.DATABASE_URL as string);
  if (args.includes('--restaurar')) {
    const filas = JSON.parse(readFileSync(args[args.indexOf('--restaurar') + 1], 'utf8')) as FilaFoto[];
    console.log(`Restauradas ${await restaurar(sql, filas)} filas.`);
    return;
  }
  const aplicar = args.includes('--apply');
  const i = args.indexOf('--backup');
  const backup = i >= 0 ? args[i + 1] : undefined;
  const r = await ejecutarReconciliacion({
    listar: () => listarTodoCloudinary(), sql, log: (l) => console.log(l),
    volcar: (filas) => volcarRespaldo(filas, backup as string),
  }, { aplicar, backup });
  if (r.codigo !== 0) process.exit(r.codigo);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('ERROR:', error instanceof Error ? error.message : 'fallo');
    process.exit(1);
  });
}
