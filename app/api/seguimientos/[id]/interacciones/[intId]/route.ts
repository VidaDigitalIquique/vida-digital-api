import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

function guard(session: any) {
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  return null;
}

export async function DELETE(_req: Request, { params }: { params: { id: string; intId: string } }) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;
  try {
    const seguimiento_id = parseInt(params.id, 10);
    const int_id = parseInt(params.intId, 10);
    const [row] = await sql`
      DELETE FROM public.seguimiento_interacciones
      WHERE id = ${int_id} AND seguimiento_id = ${seguimiento_id}
      RETURNING id`;
    if (!row) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string; intId: string } }) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;
  try {
    const seguimiento_id = parseInt(params.id, 10);
    const int_id = parseInt(params.intId, 10);
    const { resultado, proximo_contacto } = await request.json();
    const [row] = await sql`
      UPDATE public.seguimiento_interacciones
      SET resultado = ${resultado ?? null}, proximo_contacto = ${proximo_contacto ?? null}
      WHERE id = ${int_id} AND seguimiento_id = ${seguimiento_id}
      RETURNING id, resultado, proximo_contacto::text`;
    if (!row) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
