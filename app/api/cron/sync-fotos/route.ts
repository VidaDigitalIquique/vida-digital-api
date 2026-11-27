import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { listarImagenesProductos } from '@/lib/cloudinary';
import {
  aplicarPlan,
  planificarReconciliacion,
  type ProductoFoto,
  type RecursoFoto,
} from '@/lib/fotos-sync';
import flags from '@/config/feature-flags.json';

export const maxDuration = 60;

const MAX_PAGINAS = 6;
const TAMANO_PAGINA = 500;

export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const flagOn = (flags as Record<string, boolean>)['sync-fotos-reconciliacion'] === true;
  const dry = !flagOn || new URL(request.url).searchParams.get('dry') === '1';

  // Leer productos antes de listar: una foto subida entre ambas lecturas ya está
  // en la fila y también en el listado, así el plan no la confunde con una huérfana.
  const productos = (await sql`
    SELECT id, codigo, imagen_url, public_id FROM public.productos ORDER BY id
  `) as ProductoFoto[];

  const recursos: RecursoFoto[] = [];
  let cursor: string | null = null;
  let paginas = 0;
  try {
    do {
      const pagina = await listarImagenesProductos(cursor, TAMANO_PAGINA);
      recursos.push(...pagina.recursos);
      cursor = pagina.siguiente;
      paginas++;
    } while (cursor && paginas < MAX_PAGINAS);
  } catch (error) {
    console.error('POST /api/cron/sync-fotos listado:', error);
    return NextResponse.json({ ok: false, error: 'cloudinary_no_disponible' }, { status: 502 });
  }

  const plan = planificarReconciliacion(productos, recursos, process.env.CLOUDINARY_CLOUD_NAME ?? '', {
    listadoIncompleto: Boolean(cursor),
  });

  if (plan.bloqueado) {
    return NextResponse.json({
      ok: true, dry: true, aplicar: false, bloqueado: plan.bloqueado,
      conteos: plan.conteos, acciones: 0, desincronizadas_restantes: 0, muestra: [],
    });
  }

  if (dry) {
    return NextResponse.json({
      ok: true, dry: true, aplicar: false, bloqueado: null,
      conteos: plan.conteos,
      acciones: plan.acciones.length,
      desincronizadas_restantes: plan.acciones.length,
      muestra: plan.acciones.slice(0, 5),
    });
  }

  const resultado = await aplicarPlan(sql, plan, { maxAcciones: 200 });
  return NextResponse.json({
    ok: true, dry: false, aplicar: true, bloqueado: null,
    conteos: plan.conteos,
    acciones: plan.acciones.length,
    desincronizadas_restantes: resultado.pendientes + resultado.errores,
    muestra: plan.acciones.slice(0, 5),
    ...resultado,
  });
}
