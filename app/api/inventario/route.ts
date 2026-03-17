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
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = (page - 1) * limit;

  if (!empresaId) return NextResponse.json({ error: "Falta empresa_id" }, { status: 400 });

  if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
    return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
  }

  try {
    const eid = parseInt(empresaId, 10);

    // Use separate queries with/without search to avoid dynamic SQL string issues
    if (search) {
      const searchQuery = '%' + search + '%';

      const countRows = await sql`
        SELECT COUNT(*) 
        FROM ubicaciones_bodega u
        WHERE u.empresa_id = ${eid} 
        AND (LOWER(u.codigo) LIKE ${searchQuery} OR LOWER(u.ubicacion) LIKE ${searchQuery} OR LOWER(u.detalle) LIKE ${searchQuery})
      `;
      const total = parseInt(countRows[0].count, 10);

      const rows = await sql`
        SELECT 
          u.*, 
          p.detalle as producto_detalle,
          p.imagen_url as producto_imagen_url
        FROM 
          ubicaciones_bodega u
        LEFT JOIN
          productos p ON u.codigo = p.codigo AND u.empresa_id = p.empresa_id AND u.nroingreso = p.nroingreso
        WHERE u.empresa_id = ${eid} 
        AND (LOWER(u.codigo) LIKE ${searchQuery} OR LOWER(u.ubicacion) LIKE ${searchQuery} OR LOWER(u.detalle) LIKE ${searchQuery} OR LOWER(u.nroingreso) LIKE ${searchQuery})
        ORDER BY u.ubicacion ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return NextResponse.json({ 
        data: rows,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      });
    } else {
      const countRows = await sql`
        SELECT COUNT(*) FROM ubicaciones_bodega WHERE empresa_id = ${eid}
      `;
      const total = parseInt(countRows[0].count, 10);

      const rows = await sql`
        SELECT 
          u.*, 
          p.detalle as producto_detalle,
          p.imagen_url as producto_imagen_url
        FROM 
          ubicaciones_bodega u
        LEFT JOIN
          productos p ON u.codigo = p.codigo AND u.empresa_id = p.empresa_id AND u.nroingreso = p.nroingreso
        WHERE u.empresa_id = ${eid}
        ORDER BY u.ubicacion ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return NextResponse.json({ 
        data: rows,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      });
    }
  } catch (error: any) {
    console.error("GET /api/inventario error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
