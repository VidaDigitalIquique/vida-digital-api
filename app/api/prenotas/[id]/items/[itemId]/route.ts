import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sql } from '@/lib/db';
import { authOptions } from '@/lib/auth';

type RouteContext = {
  params: {
    id: string;
    itemId: string;
  };
};

async function validarSesion() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  if (rol === 'bodeguero') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }

  return { session };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await validarSesion();
  if (auth.error) return auth.error;

  const itemId = Number(params.itemId);
  const body = await request.json();
  const cajas = body?.cajas ?? null;
  const unidades = body?.unidades ?? null;
  const precio = body?.precio ?? null;

  const rows = await sql`
    UPDATE public.prenota_items SET cajas = ${cajas}, unidades = ${unidades}, precio = ${precio}
    WHERE id = ${itemId}
    RETURNING *
  `;

  return NextResponse.json((rows as any)[0] ?? null);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await validarSesion();
  if (auth.error) return auth.error;

  const itemId = Number(params.itemId);
  await sql`
    DELETE FROM public.prenota_items WHERE id = ${itemId}
  `;

  return NextResponse.json({ ok: true });
}
