import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get('codigo');

  if (!codigo) {
    return NextResponse.json({ error: 'codigo requerido' }, { status: 400 });
  }

  const rows = await sql`
    SELECT nroingreso, costo, saldo, empresa_id, fecha_ingreso
    FROM (
      SELECT
        p.nroingreso,
        p.costo::float        AS costo,
        p.saldo::float        AS saldo,
        p.empresa_id,
        MAX(inv.fechaing)::text AS fecha_ingreso
      FROM public.productos p
      LEFT JOIN sanjh.inventar inv
        ON  inv.codunico = p.codigo
        AND inv.knumdocu = split_part(p.nroingreso, '-', 3)
      WHERE p.codigo = ${codigo}
        AND p.empresa_id = 1
      GROUP BY p.nroingreso, p.costo, p.saldo, p.empresa_id

      UNION ALL

      SELECT
        p.nroingreso,
        p.costo::float        AS costo,
        p.saldo::float        AS saldo,
        p.empresa_id,
        MAX(inv.fechaing)::text AS fecha_ingreso
      FROM public.productos p
      LEFT JOIN vida.inventar inv
        ON  inv.codunico = p.codigo
        AND inv.knumdocu = split_part(p.nroingreso, '-', 3)
      WHERE p.codigo = ${codigo}
        AND p.empresa_id = 2
      GROUP BY p.nroingreso, p.costo, p.saldo, p.empresa_id
    ) combined
    ORDER BY fecha_ingreso DESC NULLS LAST
  `;

  return NextResponse.json({ data: rows });
}
