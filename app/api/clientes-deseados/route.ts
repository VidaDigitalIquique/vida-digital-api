import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const hasSearch = search.length >= 2;
    const searchPattern = `%${search.toLowerCase()}%`;

    const rows = hasSearch
      ? await sql`
          SELECT cd.*, COUNT(pd.id)::int as total_deseados
          FROM clientes_deseados cd
          LEFT JOIN productos_deseados pd ON pd.cliente_deseado_id = cd.id
          WHERE
            LOWER(cd.nombre) LIKE ${searchPattern}
            OR LOWER(cd.whatsapp) LIKE ${searchPattern}
          GROUP BY cd.id
          ORDER BY cd.nombre ASC
        `
      : await sql`
          SELECT cd.*, COUNT(pd.id)::int as total_deseados
          FROM clientes_deseados cd
          LEFT JOIN productos_deseados pd ON pd.cliente_deseado_id = cd.id
          GROUP BY cd.id
          ORDER BY cd.nombre ASC
        `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('GET /api/clientes-deseados error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nombre, pais, ciudad, whatsapp, notas } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 });
    }
    if (whatsapp && !whatsapp.startsWith('+')) {
      return NextResponse.json({ error: 'whatsapp debe empezar con +' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO clientes_deseados (nombre, pais, ciudad, whatsapp, notas)
      VALUES (${nombre.trim()}, ${pais ?? null}, ${ciudad ?? null}, ${whatsapp ?? null}, ${notas ?? null})
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/clientes-deseados error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
