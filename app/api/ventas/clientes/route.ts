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
  const ciudad = searchParams.get('ciudad')?.trim() || null;
  const pais = searchParams.get('pais')?.trim() || null;
  const estrellas = searchParams.get('estrellas') ? Number(searchParams.get('estrellas')) : null;
  const offset = Number(searchParams.get('offset') || '0');
  const hayFiltro = ciudad || pais || estrellas;

  if (!empresaSlug || (!hayFiltro && (!q || q.length < 2))) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  try {
    // Obtener aliases de la ciudad buscada (si aplica)
    let ciudadVariants: string[] | null = null;
    if (ciudad) {
      const aliasRows = await sql`
        SELECT alias FROM public.ciudad_alias
        WHERE ciudad_canonical = ${ciudad}
      `;
      ciudadVariants = [ciudad, ...(aliasRows as any[]).map((r: any) => r.alias)];
    }

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
            f.imagen_url as foto_url,
            r.estrellas
          FROM sanjh.clientes c
          LEFT JOIN public.clientes_foto f
            ON f.empresa_id = 1 AND f.kcodclie::text = c.kcodclie::text
          LEFT JOIN public.cliente_ratings r
            ON r.kcodclie = c.kcodclie::bigint
          LEFT JOIN public.ciudad_alias ca
            ON BTRIM(c.ciudad) = ca.alias
          WHERE
            (${q ? '%' + q + '%' : null}::text IS NULL
              OR c.nombress ILIKE ${'%' + (q || '') + '%'}
              OR c.kcodclie::text = ${q || ''})
            AND (${ciudadVariants}::text[] IS NULL
              OR BTRIM(c.ciudad) = ANY(${ciudadVariants}::text[]))
            AND (${pais}::text IS NULL OR c.pais ILIKE ${'%' + (pais || '') + '%'})
            AND (${estrellas}::int IS NULL OR r.estrellas = ${estrellas})
          ORDER BY c.nombress ASC
          LIMIT 50 OFFSET ${offset}
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
            f.imagen_url as foto_url,
            r.estrellas
          FROM vida.clientes c
          LEFT JOIN public.clientes_foto f
            ON f.empresa_id = 2 AND f.kcodclie::text = c.kcodclie::text
          LEFT JOIN public.cliente_ratings r
            ON r.kcodclie = c.kcodclie::bigint
          LEFT JOIN public.ciudad_alias ca
            ON BTRIM(c.ciudad) = ca.alias
          WHERE
            (${q ? '%' + q + '%' : null}::text IS NULL
              OR c.nombress ILIKE ${'%' + (q || '') + '%'}
              OR c.kcodclie::text = ${q || ''})
            AND (${ciudadVariants}::text[] IS NULL
              OR BTRIM(c.ciudad) = ANY(${ciudadVariants}::text[]))
            AND (${pais}::text IS NULL OR c.pais ILIKE ${'%' + (pais || '') + '%'})
            AND (${estrellas}::int IS NULL OR r.estrellas = ${estrellas})
          ORDER BY c.nombress ASC
          LIMIT 50 OFFSET ${offset}
        `;

    return NextResponse.json({ data: rows, hasMore: (rows as any[]).length === 50 });
  } catch (error: any) {
    console.error('GET /api/ventas/clientes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
