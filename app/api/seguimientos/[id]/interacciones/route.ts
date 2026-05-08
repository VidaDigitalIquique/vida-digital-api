import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

const TIPOS = ['llamada', 'whatsapp', 'email', 'visita', 'nota'];

function guard(session: any) {
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  return null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;
  const id = parseInt(params.id, 10);
  try {
    const rows = await sql`
      SELECT si.id, si.tipo, si.resultado, si.proximo_contacto::text, si.creado_por, si.created_at::text,
             u.nombre as creado_por_nombre
      FROM public.seguimiento_interacciones si
      LEFT JOIN public.usuarios u ON u.id = si.creado_por
      WHERE si.seguimiento_id = ${id} ORDER BY si.created_at DESC`;
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;
  try {
    const { tipo, resultado, proximo_contacto } = await request.json();
    if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
    const seguimiento_id = parseInt(params.id, 10);
    const creado_por = parseInt((session!.user as any).id, 10);
    const [row] = await sql`
      INSERT INTO public.seguimiento_interacciones (seguimiento_id, tipo, resultado, proximo_contacto, creado_por)
      VALUES (${seguimiento_id}, ${tipo}, ${resultado ?? null}, ${proximo_contacto ?? null}, ${creado_por})
      RETURNING id, seguimiento_id, tipo, created_at::text`;
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
