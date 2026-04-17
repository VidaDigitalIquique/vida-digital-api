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
    const { estado, nota, alerta_activa, comentario_aviso } = body;

    // Si se avisa al cliente, desactivar alerta automáticamente
    const alertaFinal = estado === 'avisado' ? false : alerta_activa;

    const avisadoPor = estado === 'avisado' ? (session.user as any).nombre ?? null : null;
    const comentarioAvisoFinal = estado === 'avisado' ? (comentario_aviso ?? null) : null;

    const rows = await sql`
      UPDATE productos_deseados
      SET
        estado        = COALESCE(${estado ?? null}, estado),
        nota          = COALESCE(${nota ?? null}, nota),
        alerta_activa = COALESCE(${alertaFinal ?? null}, alerta_activa),
        avisado_por   = CASE WHEN ${estado ?? null} = 'avisado' THEN ${avisadoPor} ELSE avisado_por END,
        avisado_at    = CASE WHEN ${estado ?? null} = 'avisado' THEN NOW() ELSE avisado_at END,
        comentario_aviso = CASE WHEN ${estado ?? null} = 'avisado' THEN ${comentarioAvisoFinal} ELSE comentario_aviso END,
        updated_at    = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    console.error('PUT /api/deseados/[id] error:', error);
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

    await sql`DELETE FROM productos_deseados WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/deseados/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
