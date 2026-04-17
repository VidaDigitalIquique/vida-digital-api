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
    const { accion } = await request.json();

    if (accion === 'ignorar') {
      await sql`
        UPDATE alertas_stock_bajo
        SET activa = false, updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true });
    }

    if (accion === 'no_reponer') {
      const alerta = await sql`SELECT codigo, empresa_id FROM alertas_stock_bajo WHERE id = ${id}`;
      if (alerta.length === 0) {
        return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
      }
      const { codigo } = alerta[0];

      await sql`
        UPDATE productos SET no_reponer = true WHERE codigo = ${codigo}
      `;
      await sql`
        UPDATE alertas_stock_bajo SET activa = false, updated_at = NOW()
        WHERE codigo = ${codigo}
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'accion inválida' }, { status: 400 });
  } catch (error: any) {
    console.error('PUT /api/alertas-stock/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
