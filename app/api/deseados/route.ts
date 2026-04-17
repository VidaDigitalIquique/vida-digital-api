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
    const estado = searchParams.get('estado')?.trim() ?? '';
    const search = searchParams.get('search')?.trim() ?? '';
    const sinCodigo = searchParams.get('sinCodigo') === 'true';
    const hasSearch = search.length >= 2;
    const searchPattern = `%${search.toLowerCase()}%`;

    const rows = sinCodigo
      ? estado && hasSearch
        ? await sql`
            SELECT
              pd.*,
              c.nombress as cliente_nombre,
              c.rutclien as cliente_rut,
              c.celular  as cliente_celular,
              c.ciudad   as cliente_ciudad,
              cd.nombre  as cliente_deseado_nombre,
              cd.whatsapp as cliente_deseado_whatsapp,
              cd.ciudad  as cliente_deseado_ciudad
            FROM productos_deseados pd
            LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
            LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
            WHERE pd.estado = ${estado}
              AND pd.es_china = true
              AND (
                LOWER(pd.descripcion) LIKE ${searchPattern}
                OR LOWER(c.nombress) LIKE ${searchPattern}
                OR LOWER(cd.nombre) LIKE ${searchPattern}
              )
            ORDER BY pd.created_at DESC
          `
        : estado
        ? await sql`
            SELECT
              pd.*,
              c.nombress as cliente_nombre,
              c.rutclien as cliente_rut,
              c.celular  as cliente_celular,
              c.ciudad   as cliente_ciudad,
              cd.nombre  as cliente_deseado_nombre,
              cd.whatsapp as cliente_deseado_whatsapp,
              cd.ciudad  as cliente_deseado_ciudad
            FROM productos_deseados pd
            LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
            LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
            WHERE pd.estado = ${estado}
              AND pd.es_china = true
            ORDER BY pd.created_at DESC
          `
        : hasSearch
        ? await sql`
            SELECT
              pd.*,
              c.nombress as cliente_nombre,
              c.rutclien as cliente_rut,
              c.celular  as cliente_celular,
              c.ciudad   as cliente_ciudad,
              cd.nombre  as cliente_deseado_nombre,
              cd.whatsapp as cliente_deseado_whatsapp,
              cd.ciudad  as cliente_deseado_ciudad
            FROM productos_deseados pd
            LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
            LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
            WHERE pd.es_china = true
              AND (
                LOWER(pd.descripcion) LIKE ${searchPattern}
                OR LOWER(c.nombress) LIKE ${searchPattern}
                OR LOWER(cd.nombre) LIKE ${searchPattern}
              )
            ORDER BY pd.created_at DESC
          `
        : await sql`
            SELECT
              pd.*,
              c.nombress as cliente_nombre,
              c.rutclien as cliente_rut,
              c.celular  as cliente_celular,
              c.ciudad   as cliente_ciudad,
              cd.nombre  as cliente_deseado_nombre,
              cd.whatsapp as cliente_deseado_whatsapp,
              cd.ciudad  as cliente_deseado_ciudad
            FROM productos_deseados pd
            LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
            LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
            WHERE pd.es_china = true
            ORDER BY pd.created_at DESC
          `
      : estado && hasSearch
      ? await sql`
          SELECT
            pd.*,
            c.nombress as cliente_nombre,
            c.rutclien as cliente_rut,
            c.celular  as cliente_celular,
            c.ciudad   as cliente_ciudad,
            cd.nombre  as cliente_deseado_nombre,
            cd.whatsapp as cliente_deseado_whatsapp,
            cd.ciudad  as cliente_deseado_ciudad
          FROM productos_deseados pd
          LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
          LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
          WHERE pd.estado = ${estado}
            AND (pd.es_china = false OR pd.es_china IS NULL)
            AND (
              LOWER(pd.descripcion) LIKE ${searchPattern}
              OR LOWER(pd.codigo) LIKE ${searchPattern}
              OR LOWER(c.nombress) LIKE ${searchPattern}
              OR LOWER(cd.nombre) LIKE ${searchPattern}
            )
          ORDER BY pd.created_at DESC
        `
      : estado
      ? await sql`
          SELECT
            pd.*,
            c.nombress as cliente_nombre,
            c.rutclien as cliente_rut,
            c.celular  as cliente_celular,
            c.ciudad   as cliente_ciudad,
            cd.nombre  as cliente_deseado_nombre,
            cd.whatsapp as cliente_deseado_whatsapp,
            cd.ciudad  as cliente_deseado_ciudad
          FROM productos_deseados pd
          LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
          LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
          WHERE pd.estado = ${estado}
            AND (pd.es_china = false OR pd.es_china IS NULL)
          ORDER BY pd.created_at DESC
        `
      : hasSearch
      ? await sql`
          SELECT
            pd.*,
            c.nombress as cliente_nombre,
            c.rutclien as cliente_rut,
            c.celular  as cliente_celular,
            c.ciudad   as cliente_ciudad,
            cd.nombre  as cliente_deseado_nombre,
            cd.whatsapp as cliente_deseado_whatsapp,
            cd.ciudad  as cliente_deseado_ciudad
          FROM productos_deseados pd
          LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
          LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
          WHERE (pd.es_china = false OR pd.es_china IS NULL)
            AND (
              LOWER(pd.descripcion) LIKE ${searchPattern}
              OR LOWER(pd.codigo) LIKE ${searchPattern}
              OR LOWER(c.nombress) LIKE ${searchPattern}
              OR LOWER(cd.nombre) LIKE ${searchPattern}
            )
          ORDER BY pd.created_at DESC
        `
      : await sql`
          SELECT
            pd.*,
            c.nombress as cliente_nombre,
            c.rutclien as cliente_rut,
            c.celular  as cliente_celular,
            c.ciudad   as cliente_ciudad,
            cd.nombre  as cliente_deseado_nombre,
            cd.whatsapp as cliente_deseado_whatsapp,
            cd.ciudad  as cliente_deseado_ciudad
          FROM productos_deseados pd
          LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
          LEFT JOIN clientes_deseados cd ON pd.cliente_deseado_id = cd.id
          WHERE (pd.es_china = false OR pd.es_china IS NULL)
          ORDER BY pd.created_at DESC
        `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('GET /api/deseados error:', error);
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
    const { cliente_winfac_id, cliente_deseado_id, codigo, descripcion, nota } = body;
    const es_china = body.es_china === true;

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'descripcion es requerida' }, { status: 400 });
    }
    if (!cliente_winfac_id && !cliente_deseado_id) {
      return NextResponse.json({ error: 'Se requiere cliente_winfac_id o cliente_deseado_id' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO productos_deseados
        (cliente_winfac_id, cliente_deseado_id, codigo, descripcion, nota, es_china)
      VALUES
        (${cliente_winfac_id ?? null}, ${cliente_deseado_id ?? null}, ${codigo ?? null}, ${descripcion.trim()}, ${nota ?? null}, ${es_china})
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/deseados error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
