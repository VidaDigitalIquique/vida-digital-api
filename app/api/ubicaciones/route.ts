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

  if (!empresaId) return NextResponse.json({ error: "Falta empresa_id" }, { status: 400 });

  if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
    return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
  }

  try {
    const eid = parseInt(empresaId, 10);

    let rows;
    if (search) {
      const searchQuery = '%' + search + '%';
      rows = await sql`
        SELECT 
          u.*, 
          p.detalle as producto_detalle,
          p.imagen_url as producto_imagen_url
        FROM ubicaciones_bodega u
        LEFT JOIN productos p ON u.codigo = p.codigo AND u.empresa_id = p.empresa_id AND u.nroingreso = p.nroingreso
        WHERE u.empresa_id = ${eid} 
        AND (LOWER(u.codigo) LIKE ${searchQuery} OR LOWER(u.ubicacion) LIKE ${searchQuery} OR LOWER(u.detalle) LIKE ${searchQuery} OR LOWER(u.nroingreso) LIKE ${searchQuery})
        ORDER BY u.ubicacion ASC
        LIMIT 100
      `;
    } else {
      rows = await sql`
        SELECT 
          u.*, 
          p.detalle as producto_detalle,
          p.imagen_url as producto_imagen_url
        FROM ubicaciones_bodega u
        LEFT JOIN productos p ON u.codigo = p.codigo AND u.empresa_id = p.empresa_id AND u.nroingreso = p.nroingreso
        WHERE u.empresa_id = ${eid}
        ORDER BY u.ubicacion ASC
        LIMIT 100
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/ubicaciones error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
