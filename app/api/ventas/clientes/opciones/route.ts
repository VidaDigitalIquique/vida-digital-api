import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || (rol !== 'admin' && rol !== 'vendedor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const rows = await sql`
      SELECT DISTINCT BTRIM(ciudad) as ciudad, BTRIM(pais) as pais
      FROM vida.clientes
      WHERE BTRIM(ciudad) != '' AND ciudad IS NOT NULL
         OR BTRIM(pais) != '' AND pais IS NOT NULL
      ORDER BY ciudad ASC
    `;
    const ciudades = [...new Set(
      rows.map((r: any) => r.ciudad).filter(Boolean)
    )].sort() as string[];
    const paises = [...new Set(
      rows.map((r: any) => r.pais).filter(Boolean)
    )].sort() as string[];
    return NextResponse.json({ ciudades, paises });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
