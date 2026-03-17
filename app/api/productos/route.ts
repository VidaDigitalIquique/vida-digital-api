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

    // Use branch logic to avoid dynamic sql() calls which Neon doesn't support
    let rows;

    if (search && soloStock && soloNuevo) {
      const sq = '%' + search + '%';
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} AND (LOWER(codigo) LIKE ${sq} OR LOWER(detalle) LIKE ${sq}) AND saldo > 0 AND es_nuevo = true ORDER BY codigo ASC LIMIT 100`;
    } else if (search && soloStock) {
      const sq = '%' + search + '%';
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} AND (LOWER(codigo) LIKE ${sq} OR LOWER(detalle) LIKE ${sq}) AND saldo > 0 ORDER BY codigo ASC LIMIT 100`;
    } else if (search && soloNuevo) {
      const sq = '%' + search + '%';
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} AND (LOWER(codigo) LIKE ${sq} OR LOWER(detalle) LIKE ${sq}) AND es_nuevo = true ORDER BY codigo ASC LIMIT 100`;
    } else if (soloStock && soloNuevo) {
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} AND saldo > 0 AND es_nuevo = true ORDER BY codigo ASC LIMIT 100`;
    } else if (search) {
      const sq = '%' + search + '%';
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} AND (LOWER(codigo) LIKE ${sq} OR LOWER(detalle) LIKE ${sq}) ORDER BY codigo ASC LIMIT 100`;
    } else if (soloStock) {
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} AND saldo > 0 ORDER BY codigo ASC LIMIT 100`;
    } else if (soloNuevo) {
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} AND es_nuevo = true ORDER BY codigo ASC LIMIT 100`;
    } else {
      rows = await sql`SELECT * FROM productos WHERE empresa_id = ${eid} ORDER BY codigo ASC LIMIT 100`;
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/productos error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
