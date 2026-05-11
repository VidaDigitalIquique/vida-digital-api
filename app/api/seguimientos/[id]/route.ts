import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  try {
    const { estado } = await request.json();
    const id = parseInt(params.id, 10);
    const [row] = await sql`
      UPDATE public.seguimientos SET
        estado     = COALESCE(${estado ?? null}, estado),
        updated_at = now()
      WHERE id = ${id} RETURNING *`;
    if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
