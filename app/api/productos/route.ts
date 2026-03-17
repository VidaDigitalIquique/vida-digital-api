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

  const eid = parseInt(empresaId, 10);
  if (!(session.user as any).empresas.includes(eid)) {
    return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
  }

  try {
    const searchPattern = `%${search}%`;

    const rows = await sql`
      SELECT
        codigo,
        MAX(id) as id,
        MAX(detalle) as detalle,
        SUM(saldo) as saldo,
        MAX(prcventa) as prcventa,
        MAX(prcminimo) as prcminimo,
        MAX(costo) as costo,
        MAX(cif) as cif,
        MAX(umed) as umed,
        MAX(imagen_url) as imagen_url,
        BOOL_OR(es_nuevo) as es_nuevo
      FROM productos
      WHERE empresa_id = ${eid}
        AND (${search} = '' OR LOWER(codigo) LIKE ${searchPattern} OR LOWER(detalle) LIKE ${searchPattern})
      GROUP BY codigo
      HAVING
        (${soloStock} = false OR SUM(saldo) > 0)
        AND (${soloNuevo} = false OR BOOL_OR(es_nuevo) = true)
      ORDER BY codigo ASC
      LIMIT 200
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/productos error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
