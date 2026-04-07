import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const soloStock = searchParams.get('soloStock') === 'true';
  const soloNuevo = searchParams.get('soloNuevo') === 'true';

  try {
    const searchPattern = `%${search}%`;
    if (!search) {
      return NextResponse.json({ data: [] });
    }

    const empresaIds = (session.user as any).empresas || [];
    const rows = await sql`
      SELECT
        p.codigo,
        MAX(p.id) as id,
        MAX(p.detalle) as detalle,
        SUM(p.saldo) as saldo,
        MAX(p.prcventa) as prcventa,
        MAX(p.prcminimo) as prcminimo,
        MAX(p.costo) as costo,
        MAX(p.cif) as cif,
        MAX(p.umed) as umed,
        MAX(p.imagen_url) as imagen_url,
        BOOL_OR(p.es_nuevo) as es_nuevo,
        MAX(p.cantcaja) as cantcaja,
        MAX(p.pesocaja) as pesocaja,
        MAX(p.cubicaja) as cubicaja,
        MAX(p.nroingreso) as nroingreso,
        MAX(p.empresa_id) as empresa_id,
        MAX(e.nombre) as nombre_empresa
      FROM productos p
      JOIN empresas e ON e.id = p.empresa_id
      WHERE p.empresa_id = ANY(${empresaIds})
        AND (${search} = '' OR LOWER(p.codigo) LIKE ${searchPattern} OR LOWER(p.detalle) LIKE ${searchPattern})
      GROUP BY p.codigo
      HAVING
        (${soloStock} = false OR SUM(saldo) > 0)
        AND (${soloNuevo} = false OR BOOL_OR(p.es_nuevo) = true)
      ORDER BY p.codigo ASC
      LIMIT 200
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/productos error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
