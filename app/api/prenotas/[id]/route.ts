import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sql } from '@/lib/db';
import { authOptions } from '@/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

function getUsuarioId(session: any) {
  return Number((session?.user as any)?.id);
}

async function validarSesion() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  if (rol === 'bodeguero') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }

  return { session, usuarioId: getUsuarioId(session) };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await validarSesion();
  if (auth.error) return auth.error;

  const id = Number(params.id);
  const prenotas = await sql`
    SELECT * FROM public.prenotas WHERE id = ${id} AND usuario_id = ${auth.usuarioId}
  `;
  const prenota = (prenotas as any)[0];

  if (!prenota) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  }

  const items = await sql`
    SELECT * FROM public.prenota_items WHERE prenota_id = ${id} ORDER BY created_at ASC
  `;

  return NextResponse.json({ ...prenota, items });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await validarSesion();
  if (auth.error) return auth.error;

  const id = Number(params.id);
  const body = await request.json();
  const titulo = body?.titulo ?? null;
  const kcodclie = body?.kcodclie ?? null;
  const nombre_cliente = body?.nombre_cliente ?? null;

  const rows = await sql`
    UPDATE public.prenotas
    SET titulo = ${titulo}, kcodclie = ${kcodclie}, nombre_cliente = ${nombre_cliente}, updated_at = now()
    WHERE id = ${id} AND usuario_id = ${auth.usuarioId}
    RETURNING *
  `;

  return NextResponse.json((rows as any)[0] ?? null);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await validarSesion();
  if (auth.error) return auth.error;

  const id = Number(params.id);
  await sql`
    DELETE FROM public.prenotas WHERE id = ${id} AND usuario_id = ${auth.usuarioId}
  `;

  return NextResponse.json({ ok: true });
}
