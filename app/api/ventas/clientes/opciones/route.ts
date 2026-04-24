import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || (rol !== 'admin' && rol !== 'vendedor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url ?? 'http://localhost');
  const paisFiltro = searchParams.get('pais')?.trim().toUpperCase() || null;
  try {
    const [ciudadRows, aliasRows] = await Promise.all([
      sql`
        SELECT DISTINCT BTRIM(ciudad) as ciudad, BTRIM(pais) as pais
        FROM vida.clientes
        WHERE (BTRIM(ciudad) != '' AND ciudad IS NOT NULL
            OR BTRIM(pais) != '' AND pais IS NOT NULL)
          AND (${paisFiltro}::text IS NULL OR UPPER(BTRIM(pais)) = ${paisFiltro})
        ORDER BY ciudad ASC
      `,
      sql`
        SELECT alias, ciudad_canonical
        FROM public.ciudad_alias
      `,
    ]);

    // Construir mapa alias → canonical
    const aliasMap = new Map<string, string>();
    for (const row of aliasRows as any[]) {
      aliasMap.set(row.alias, row.ciudad_canonical);
    }

    // Normalizar ciudades: reemplazar alias por canonical
    const ciudadesNormalizadas = (ciudadRows as any[])
      .map((r) => r.ciudad)
      .filter(Boolean)
      .map((c: string) => aliasMap.get(c) ?? c);

    // Deduplicar y ordenar
    const ciudades = Array.from(new Set(ciudadesNormalizadas)).sort() as string[];

    const paises = Array.from(new Set(
      (ciudadRows as any[]).map((r) => r.pais).filter(Boolean)
    )).sort() as string[];

    return NextResponse.json({ ciudades, paises });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
