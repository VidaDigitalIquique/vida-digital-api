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
  const current = await sql`
    SELECT titulo_base FROM public.prenotas WHERE id = ${id} AND usuario_id = ${auth.usuarioId}
  `;
  const tituloBase = (current as any)[0]?.titulo_base;
  const nuevoTitulo = body?.nombre_cliente !== undefined
    ? (body.nombre_cliente ? `${tituloBase} — ${body.nombre_cliente}` : tituloBase)
    : undefined;

  const rows = await sql`
    UPDATE public.prenotas
    SET
      titulo         = CASE WHEN ${nuevoTitulo !== undefined} THEN ${nuevoTitulo ?? null} ELSE titulo END,
      kcodclie       = CASE WHEN ${body?.kcodclie !== undefined} THEN ${body?.kcodclie ?? null} ELSE kcodclie END,
      nombre_cliente = CASE WHEN ${body?.nombre_cliente !== undefined} THEN ${body?.nombre_cliente ?? null} ELSE nombre_cliente END,
      tipo_documento = CASE WHEN ${body?.tipo_documento !== undefined} THEN ${body?.tipo_documento ?? null} ELSE tipo_documento END,
      kcodclie_factura = CASE WHEN ${body?.kcodclie_factura !== undefined} THEN ${body?.kcodclie_factura ?? null} ELSE kcodclie_factura END,
      nombre_cliente_factura = CASE WHEN ${body?.nombre_cliente_factura !== undefined} THEN ${body?.nombre_cliente_factura ?? null} ELSE nombre_cliente_factura END,
      updated_at     = now()
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
