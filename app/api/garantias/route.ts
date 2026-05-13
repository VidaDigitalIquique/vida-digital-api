import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function guard(session: any) {
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes') ? parseInt(searchParams.get('mes')!) : null;
  const anio = searchParams.get('anio') ? parseInt(searchParams.get('anio')!) : null;
  const search = searchParams.get('search')?.trim() || null;
  const estado = searchParams.get('estado') || null;

  try {
    let rows;
    if (search) {
      const pattern = `%${search}%`;
      rows = await sql`
        SELECT id, knumfoli, cliente, estado, created_at::text, updated_at::text
        FROM public.garantias
        WHERE (knumfoli ILIKE ${pattern} OR cliente ILIKE ${pattern})
          AND (${mes}::integer IS NULL OR EXTRACT(MONTH FROM created_at) = ${mes})
          AND (${anio}::integer IS NULL OR EXTRACT(YEAR FROM created_at) = ${anio})
          AND (${estado}::text IS NULL OR estado = ${estado})
        ORDER BY created_at DESC
        LIMIT 200
      `;
    } else {
      rows = await sql`
        SELECT id, knumfoli, cliente, estado, created_at::text, updated_at::text
        FROM public.garantias
        WHERE (${mes}::integer IS NULL OR EXTRACT(MONTH FROM created_at) = ${mes})
          AND (${anio}::integer IS NULL OR EXTRACT(YEAR FROM created_at) = ${anio})
          AND (${estado}::text IS NULL OR estado = ${estado})
        ORDER BY created_at DESC
        LIMIT 200
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  try {
    const { knumfoli, cliente } = await request.json();
    if (!knumfoli?.trim() || !cliente?.trim()) {
      return NextResponse.json({ error: 'knumfoli y cliente son requeridos' }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO public.garantias (knumfoli, cliente)
      VALUES (${knumfoli.trim()}, ${cliente.trim()})
      RETURNING id, knumfoli, cliente, estado, created_at::text, updated_at::text
    `;

    const usuario = (session!.user as any).name || (session!.user as any).nombre || 'desconocido';
    await sql`
      INSERT INTO public.garantias_log (garantia_id, usuario, campo, valor_nuevo)
      VALUES (${row.id}, ${usuario}, 'creacion', ${row.knumfoli})
    `;

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
