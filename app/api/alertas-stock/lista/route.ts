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
      SELECT
        a.*,
        COALESCE(c.total_clientes, 0) as total_clientes
      FROM alertas_stock_bajo a
      LEFT JOIN (
        SELECT
          i.codunico,
          COUNT(DISTINCT m.kcodclie)::int as total_clientes
        FROM vida.itemdcto i
        INNER JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
        WHERE m.tipomovi = 'V'
        GROUP BY i.codunico
      ) c ON c.codunico = a.codigo
      WHERE a.activa = true
      ORDER BY c.total_clientes DESC NULLS LAST
    `;
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('GET /api/alertas-stock/lista error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
