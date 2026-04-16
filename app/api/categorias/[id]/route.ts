import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const role = user?.rol;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = params;

    const count = await sql`
      SELECT COUNT(*)::int as total
      FROM productos
      WHERE categoria = (SELECT nombre FROM categorias WHERE id = ${id})
    `;

    if (count[0].total > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una categoría con productos asignados' },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM categorias WHERE id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
