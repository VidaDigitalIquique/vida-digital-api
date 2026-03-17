import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const user = session.user as any;

  try {
    const body = await request.json();
    const { prcventa, prcminimo, imagen_url, es_nuevo } = body;
    const pid = parseInt(params.id, 10);

    // Must be admin or supervisor to edit prices.
    const isPriceEdit = prcventa !== undefined || prcminimo !== undefined;
    if (isPriceEdit && !['admin', 'supervisor'].includes(user.rol)) {
      return NextResponse.json({ error: "Permisos insuficientes para editar precios" }, { status: 403 });
    }

    // Must be admin to edit imagen_url and es_nuevo
    const isImageOrNuevoEdit = imagen_url !== undefined || es_nuevo !== undefined;
    if (isImageOrNuevoEdit && user.rol !== 'admin') {
      return NextResponse.json({ error: "Permisos insuficientes para modificar producto" }, { status: 403 });
    }

    // Fetch existing product to verify enterprise access
    const existing = await sql`SELECT empresa_id FROM productos WHERE id = ${pid}`;
    if (existing.length === 0) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    
    if (!user.empresas.includes(existing[0].empresa_id)) {
      return NextResponse.json({ error: "No tienes acceso a este producto" }, { status: 403 });
    }

    // Build sequential updates to avoid dynamic sql() string construction
    const ts = new Date().toISOString();
    let updated: any[] = [];

    if (prcventa !== undefined && prcminimo !== undefined && imagen_url !== undefined && es_nuevo !== undefined) {
      updated = await sql`UPDATE productos SET prcventa = ${prcventa}, prcminimo = ${prcminimo}, imagen_url = ${imagen_url}, es_nuevo = ${es_nuevo}, updated_at = NOW() WHERE id = ${pid} RETURNING *`;
    } else if (prcventa !== undefined && prcminimo !== undefined) {
      updated = await sql`UPDATE productos SET prcventa = ${prcventa}, prcminimo = ${prcminimo}, updated_at = NOW() WHERE id = ${pid} RETURNING *`;
    } else if (prcventa !== undefined) {
      updated = await sql`UPDATE productos SET prcventa = ${prcventa}, updated_at = NOW() WHERE id = ${pid} RETURNING *`;
    } else if (prcminimo !== undefined) {
      updated = await sql`UPDATE productos SET prcminimo = ${prcminimo}, updated_at = NOW() WHERE id = ${pid} RETURNING *`;
    } else if (imagen_url !== undefined && es_nuevo !== undefined) {
      updated = await sql`UPDATE productos SET imagen_url = ${imagen_url}, es_nuevo = ${es_nuevo}, updated_at = NOW() WHERE id = ${pid} RETURNING *`;
    } else if (imagen_url !== undefined) {
      updated = await sql`UPDATE productos SET imagen_url = ${imagen_url}, updated_at = NOW() WHERE id = ${pid} RETURNING *`;
    } else if (es_nuevo !== undefined) {
      updated = await sql`UPDATE productos SET es_nuevo = ${es_nuevo}, updated_at = NOW() WHERE id = ${pid} RETURNING *`;
    } else {
      return NextResponse.json({ message: "Nada que actualizar" });
    }

    return NextResponse.json({ data: updated[0], message: "Producto actualizado" });

  } catch (error: any) {
    console.error("PUT /api/productos/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
