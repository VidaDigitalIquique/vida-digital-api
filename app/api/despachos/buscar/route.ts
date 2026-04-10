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
  const folio = searchParams.get('folio')?.trim();

  if (!folio || folio.length < 2) {
    return NextResponse.json({ error: 'Folio requerido' }, { status: 400 });
  }

  try {
    const rows = await sql`
      SELECT 
        d.id,
        d.folio,
        d.imagen_url,
        d.empresa_id,
        d.subido_por,
        d.created_at,
        e.nombre as empresa_nombre
      FROM public.despachos_bodega d
      LEFT JOIN public.empresas e ON e.id = d.empresa_id
      WHERE d.folio ILIKE ${'%' + folio + '%'}
      ORDER BY d.created_at DESC
      LIMIT 10
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('GET /api/despachos/buscar error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
