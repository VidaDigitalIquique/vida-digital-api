import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CAMPOS_VALIDOS = ['estado', 'knumfoli', 'cliente', 'monto', 'observaciones'];

function guard(session: any) {
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  return null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  try {
    const { campo, valor } = await request.json();
    if (!CAMPOS_VALIDOS.includes(campo)) {
      return NextResponse.json({ error: 'Campo no valido' }, { status: 400 });
    }
    if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
      return NextResponse.json({ error: 'valor requerido' }, { status: 400 });
    }

    const { id } = params;

    const existingRows = await sql`
      SELECT id, knumfoli, cliente, monto, observaciones, estado FROM public.garantias WHERE id = ${id}
    `;
    if (existingRows.length === 0) return NextResponse.json({ error: 'Garantia no encontrada' }, { status: 404 });
    const existing = existingRows[0];

    const valorAnterior = existing[campo] ?? '';
    const valorNuevo = typeof valor === 'string' ? valor.trim() : valor;

    const [updated] = await sql`
      UPDATE public.garantias
      SET ${sql.unsafe(campo)} = ${valorNuevo}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, knumfoli, cliente, monto, observaciones, estado, created_at::text, updated_at::text
    `;

    const usuario = (session!.user as any).name || (session!.user as any).nombre || 'desconocido';
    await sql`
      INSERT INTO public.garantias_log (garantia_id, usuario, campo, valor_anterior, valor_nuevo)
      VALUES (${id}, ${usuario}, ${campo}, ${String(valorAnterior)}, ${String(valorNuevo)})
    `;

    return NextResponse.json({ data: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
