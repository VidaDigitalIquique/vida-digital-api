import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Lista 1: productos con código (ya hemos tenido) ordenados por ganancia histórica
    const vidaDigital = await sql`
      SELECT
        pd.id,
        pd.codigo,
        pd.descripcion,
        pd.nota,
        pd.estado,
        pd.alerta_activa,
        pd.created_at,
        pd.imagen_url,
        pd.cliente_winfac_id,
        pd.cliente_deseado_id,
        pd.es_china,
        c.nombress as cliente_nombre,
        c.ciudad   as cliente_ciudad,
        cd.nombre  as cliente_deseado_nombre,
        cd.whatsapp as cliente_deseado_whatsapp,
        cd.ciudad  as cliente_deseado_ciudad,
        COALESCE(g.ganancia_total, 0) as ganancia_total,
        COALESCE(g.unidades_vendidas, 0) as unidades_vendidas
      FROM public.productos_deseados pd
      LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
      LEFT JOIN public.clientes_deseados cd ON pd.cliente_deseado_id = cd.id
      LEFT JOIN (
        SELECT
          i.codunico as codigo,
          SUM(i.cantsali) as unidades_vendidas,
          SUM((i.precread - i.cosunita) * i.cantsali) as ganancia_total
        FROM vida.itemdcto i
        INNER JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
        WHERE m.tipomovi = 'V'
          AND i.precread > 0
          AND i.cantsali > 0
          AND i.cosunita > 0
        GROUP BY i.codunico
      ) g ON g.codigo = pd.codigo
      WHERE pd.es_china = true
        AND pd.codigo IS NOT NULL
        AND pd.estado = 'pendiente'
      ORDER BY g.ganancia_total DESC NULLS LAST
    `;

    // Lista 2: productos sin código (nunca hemos traído) ordenados por cantidad de solicitudes
    const clientes = await sql`
      SELECT
        MIN(pd.id) as id,
        pd.descripcion,
        COUNT(*) as total_solicitudes,
        MAX(pd.created_at) as created_at,
        MAX(pd.nota) as nota,
        MAX(pd.imagen_url) as imagen_url,
        STRING_AGG(
          COALESCE(c.nombress, cd.nombre, 'Cliente desconocido'),
          ', '
          ORDER BY pd.created_at DESC
        ) as clientes_nombres
      FROM public.productos_deseados pd
      LEFT JOIN vida.clientes c ON pd.cliente_winfac_id::bigint = c.kcodclie
      LEFT JOIN public.clientes_deseados cd ON pd.cliente_deseado_id = cd.id
      WHERE pd.es_china = true
        AND (pd.codigo IS NULL OR pd.codigo = '')
        AND pd.estado = 'pendiente'
      GROUP BY pd.descripcion
      ORDER BY total_solicitudes DESC, created_at DESC
    `;

    return NextResponse.json({
      vida_digital: vidaDigital,
      clientes,
    });
  } catch (error: any) {
    console.error('GET /api/deseados/china error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
