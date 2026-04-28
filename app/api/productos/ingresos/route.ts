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
    SELECT
      nroingreso,
      costo::float as costo,
      fecha_ingreso::text as fecha_ingreso,
      saldo::float as saldo,
      empresa_id
    FROM public.productos
    WHERE codigo = ${codigo}
    ORDER BY fecha_ingreso DESC NULLS LAST
  `;

  return NextResponse.json({ data: rows });
}
