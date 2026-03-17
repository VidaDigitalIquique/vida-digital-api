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
    let rows;

    const baseQuery = `
      SELECT 
        MIN(id) as id,
        empresa_id,
        codigo,
        MAX(detalle) as detalle,
        SUM(saldo) as saldo,
        MAX(umed) as umed,
        MAX(prcventa) as prcventa,
        MAX(prcminimo) as prcminimo,
        MAX(costo) as costo,
        MAX(cif) as cif,
        MAX(cantcaja) as cantcaja,
        MAX(imagen_url) as imagen_url,
        BOOL_OR(es_nuevo) as es_nuevo
      FROM productos
      WHERE empresa_id = $1
    `;

    let query = baseQuery;
    const params: any[] = [eid];

    if (search) {
      query += ` AND (LOWER(codigo) LIKE $2 OR LOWER(detalle) LIKE $2)`;
      params.push(`%${search}%`);
    }

    if (soloNuevo) {
      query += ` AND es_nuevo = true`;
    }

    query += ` GROUP BY empresa_id, codigo`;

    if (soloStock) {
      query += ` HAVING SUM(saldo) > 0`;
    }

    query += ` ORDER BY codigo ASC LIMIT 100`;

    rows = await sql.unsafe(query, params);

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/productos error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
