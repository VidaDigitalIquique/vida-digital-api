import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('empresa');
  const search = searchParams.get('search')?.toLowerCase() || '';
  const soloStock = searchParams.get('soloStock') === 'true';
  const soloNuevo = searchParams.get('soloNuevo') === 'true';

  if (!empresaId) return NextResponse.json({ error: "Falta empresa_id" }, { status: 400 });

  if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
    return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
  }

  try {
    const eid = parseInt(empresaId, 10);
    const searchPattern = `%${search}%`;

    const rows = await sql`
      SELECT
        u.codigo,
        MAX(u.detalle) as detalle,
        MAX(u.empresa_id) as empresa_id,
        MAX(p.imagen_url) as producto_imagen_url,
        MAX(p.cantcaja) as cantcaja,
        MAX(p.umed) as umed,
        SUM(u.saldo) as saldo_total,
        BOOL_OR(p.es_nuevo) as es_nuevo,
        CASE 
          WHEN BOOL_AND(u.fisico IS NULL) THEN NULL 
          ELSE SUM(COALESCE(u.fisico, 0)) 
        END as fisico_total,
        CASE 
          WHEN BOOL_AND(u.fisico IS NULL) THEN NULL 
          ELSE SUM(COALESCE(u.fisico, 0)) - SUM(u.saldo)
        END as diferencia_total,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.ubicacion ORDER BY u.ubicacion ASC), NULL) as ubicaciones,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', u.id,
            'nroingreso', u.nroingreso,
            'ubicacion', u.ubicacion,
            'saldo', u.saldo,
            'saldocajas', u.saldocajas,
            'fisico', u.fisico,
            'diferencia', u.diferencia,
            'observaciones', u.observaciones,
            'updated_at', u.updated_at,
            'fisico_cajas', u.fisico_cajas,
            'fisico_unidades', u.fisico_unidades
          ) ORDER BY u.nroingreso ASC
        ) as lotes
      FROM ubicaciones_bodega u
      LEFT JOIN productos p ON u.codigo = p.codigo
        AND u.empresa_id = p.empresa_id
        AND u.nroingreso = p.nroingreso
      WHERE u.empresa_id = ${eid}
        AND (
          ${search} = ''
          OR LOWER(u.codigo) LIKE ${searchPattern}
          OR LOWER(u.ubicacion) LIKE ${searchPattern}
          OR LOWER(u.detalle) LIKE ${searchPattern}
          OR LOWER(u.nroingreso) LIKE ${searchPattern}
        )
      GROUP BY u.codigo
      HAVING
        (${soloStock} = false OR SUM(u.saldo) > 0)
        AND (${soloNuevo} = false OR BOOL_OR(p.es_nuevo) = true)
      ORDER BY u.codigo ASC
      LIMIT 100
    `;

    console.log('DEBUG lote sample:', JSON.stringify(rows[0]?.lotes?.[0]));
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/ubicaciones error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
