import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rol = (session.user as any)?.rol;
  if (rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const id = Number(params.id);
  await sql`DELETE FROM public.registro_notas_bodega WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
