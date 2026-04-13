import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session || (rol !== 'admin' && rol !== 'vendedor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const empresaSlug = searchParams.get('empresaSlug')?.trim();

  if (!q || !empresaSlug || q.length < 2) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  try {
    const rows = empresaSlug === 'sanjh'
      ? await sql`
          SELECT
            c.kcodclie,
            c.nombress,
            c.rutclien,
            c.digiveri,
            c.celular,
            c.ciudad,
            c.pais,
            c.comprador,
            f.imagen_url as foto_url
          FROM sanjh.clientes c
          LEFT JOIN public.clientes_foto f
            ON f.empresa_id = 1 AND f.kcodclie::text = c.kcodclie::text
          WHERE c.nombress ILIKE ${'%' + q + '%'}
             OR c.kcodclie::text = ${q}
          ORDER BY c.nombress ASC
          LIMIT 20
        `
      : await sql`
          SELECT
            c.kcodclie,
            c.nombress,
            c.rutclien,
            c.digiveri,
            c.celular,
            c.ciudad,
            c.pais,
            c.comprador,
            f.imagen_url as foto_url
          FROM vida.clientes c
          LEFT JOIN public.clientes_foto f
            ON f.empresa_id = 2 AND f.kcodclie::text = c.kcodclie::text
          WHERE c.nombress ILIKE ${'%' + q + '%'}
             OR c.kcodclie::text = ${q}
          ORDER BY c.nombress ASC
          LIMIT 20
        `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('GET /api/ventas/clientes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
