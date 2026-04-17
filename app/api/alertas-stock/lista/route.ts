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
      SELECT *
      FROM alertas_stock_bajo
      WHERE activa = true
      ORDER BY saldo ASC, updated_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('GET /api/alertas-stock/lista error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
