import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { nombre, pais, ciudad, whatsapp, notas } = body;

    if (whatsapp && !whatsapp.startsWith('+')) {
      return NextResponse.json({ error: 'whatsapp debe empezar con +' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE clientes_deseados
      SET
        nombre   = COALESCE(${nombre ?? null}, nombre),
        pais     = COALESCE(${pais ?? null}, pais),
        ciudad   = COALESCE(${ciudad ?? null}, ciudad),
        whatsapp = COALESCE(${whatsapp ?? null}, whatsapp),
        notas    = COALESCE(${notas ?? null}, notas),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    console.error('PUT /api/clientes-deseados/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede eliminar' }, { status: 403 });
  }

  try {
    const { id } = params;

    const check = await sql`
      SELECT COUNT(*)::int as total FROM productos_deseados WHERE cliente_deseado_id = ${id}
    `;
    if ((check[0]?.total ?? 0) > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: el cliente tiene productos deseados asociados' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM clientes_deseados WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/clientes-deseados/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
