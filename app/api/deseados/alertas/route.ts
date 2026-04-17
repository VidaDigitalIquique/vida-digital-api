import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const rows = await sql`
      SELECT COUNT(*)::int as count
      FROM productos_deseados
      WHERE alerta_activa = true
        AND estado = 'pendiente'
    `;
    return NextResponse.json({ count: rows[0]?.count ?? 0 });
  } catch (error: any) {
    console.error('GET /api/deseados/alertas error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
