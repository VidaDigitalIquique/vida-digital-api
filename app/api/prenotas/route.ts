import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sql } from '@/lib/db';
import { authOptions } from '@/lib/auth';

function getUsuarioId(session: any) {
  return Number((session?.user as any)?.id);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (rol === 'bodeguero') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const usuarioId = getUsuarioId(session);
  const rows = await sql`
    SELECT * FROM public.prenotas
    WHERE usuario_id = ${usuarioId}
    ORDER BY updated_at DESC
  `;

  return NextResponse.json({ data: rows });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (rol === 'bodeguero') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const usuarioId = getUsuarioId(session);
  const count = await sql`
    SELECT COUNT(*) FROM public.prenotas WHERE usuario_id = ${usuarioId}
  `;
  const n = Number((count as any)[0].count) + 1;
  const fecha = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const titulo = `Pre-nota #${n} — ${fecha}`;
  const rows = await sql`
    INSERT INTO public.prenotas (titulo, titulo_base, usuario_id)
    VALUES (${titulo}, ${titulo}, ${usuarioId})
    RETURNING *
  `;

  return NextResponse.json((rows as any)[0]);
}
