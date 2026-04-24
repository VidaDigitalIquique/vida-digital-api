import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sql } from '@/lib/db';
import { authOptions } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rol = (session.user as any)?.rol;
  if (rol !== 'admin' && rol !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await req.json();
  const accion = body?.accion;

  if (accion !== 'aprobar' && accion !== 'rechazar') {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }

  if (accion === 'aprobar') {
    const rows = await sql`
      SELECT cliente_deseado_id, kcodclie
      FROM public.conversion_sugerencias
      WHERE id = ${id}
    `;

    const sugerencia = rows[0];

    if (!sugerencia) {
      return NextResponse.json({ error: 'Sugerencia no encontrada' }, { status: 404 });
    }

    await sql`
      UPDATE public.productos_deseados
      SET cliente_winfac_id = ${String(sugerencia.kcodclie)}, cliente_deseado_id = NULL
      WHERE cliente_deseado_id = ${sugerencia.cliente_deseado_id}
    `;

    await sql`
      UPDATE public.conversion_sugerencias
      SET estado = 'aprobada', updated_at = now()
      WHERE id = ${id}
    `;

    await sql`
      UPDATE public.conversion_sugerencias
      SET estado = 'rechazada', cliente_deseado_id = NULL, updated_at = now()
      WHERE cliente_deseado_id = ${sugerencia.cliente_deseado_id} AND estado = 'pendiente'
    `;

    await sql`
      UPDATE public.conversion_sugerencias
      SET cliente_deseado_id = NULL
      WHERE id = ${id}
    `;

    await sql`
      DELETE FROM public.clientes_deseados
      WHERE id = ${sugerencia.cliente_deseado_id}
    `;
  }

  if (accion === 'rechazar') {
    await sql`
      UPDATE public.conversion_sugerencias
      SET estado = 'rechazada', updated_at = now()
      WHERE id = ${id}
    `;
  }

  return NextResponse.json({ ok: true });
}
