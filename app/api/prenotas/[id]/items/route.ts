import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sql } from '@/lib/db';
import { authOptions } from '@/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (rol === 'bodeguero') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const id = Number(params.id);
  const body = await request.json();
  const {
    codigo,
    descripcion,
    imagen_url,
    empresa_id,
    cajas,
    unidades,
    precio,
    saldo_zofri,
  } = body ?? {};

  const rows = await sql`
    INSERT INTO public.prenota_items (prenota_id, codigo, descripcion, imagen_url, empresa_id, cajas, unidades, precio, saldo_zofri)
    VALUES (${id}, ${codigo}, ${descripcion}, ${imagen_url}, ${empresa_id}, ${cajas}, ${unidades}, ${precio}, ${saldo_zofri})
    RETURNING *
  `;

  await sql`
    UPDATE public.prenotas SET updated_at = now() WHERE id = ${id}
  `;

  return NextResponse.json((rows as any)[0]);
}
