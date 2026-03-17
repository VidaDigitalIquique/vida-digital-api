import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = params;

  try {
    const { titulo, descripcion, activo, items } = await request.json();

    // Verify ownership
    const existing = await sql`SELECT empresa_id FROM catalogos WHERE id = ${id}`;
    if (existing.length === 0) return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 });
    if (!(session.user as any).empresas.includes(existing[0].empresa_id)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Update catalog info
    await sql`
      UPDATE catalogos 
      SET 
        titulo = COALESCE(${titulo !== undefined ? titulo : null}, titulo),
        descripcion = COALESCE(${descripcion !== undefined ? descripcion : null}, descripcion),
        activo = COALESCE(${activo !== undefined ? activo : null}, activo),
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Process items if provided
    // This is a simple full-replacement strategy for ease of admin UI via drag-and-drop
    if (items && Array.isArray(items)) {
      await sql`DELETE FROM catalogo_items WHERE catalogo_id = ${id}`;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await sql`
          INSERT INTO catalogo_items (catalogo_id, producto_id, tipo, url_media, orden, hide_price)
          VALUES (
            ${id}, 
            ${item.producto_id || null}, 
            ${item.tipo}, 
            ${item.url_media || null}, 
            ${i}, 
            ${item.hide_price || false}
          )
        `;
      }
    }

    return NextResponse.json({ message: "Catálogo actualizado" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const { id } = params;
  
  try {
    const existing = await sql`SELECT empresa_id FROM catalogos WHERE id = ${id}`;
    if (existing.length === 0) return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 });
    if (!(session.user as any).empresas.includes(existing[0].empresa_id)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Items cascade correctly via DB schema ON DELETE CASCADE
    await sql`DELETE FROM catalogos WHERE id = ${id}`;

    return NextResponse.json({ message: "Catálogo eliminado" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Fetch single catalog + items for the admin view
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = params;
    
    const catRows = await sql`SELECT * FROM catalogos WHERE id = ${id}`;
    if (catRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const catalog = catRows[0];

    if (!(session.user as any).empresas.includes(catalog.empresa_id)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const items = await sql`
      SELECT 
        ci.*,
        p.codigo as producto_codigo,
        p.detalle as producto_detalle,
        p.imagen_url as producto_imagen_url,
        p.prcventa,
        p.es_nuevo
      FROM catalogo_items ci
      LEFT JOIN productos p ON ci.producto_id = p.id
      WHERE ci.catalogo_id = ${id}
      ORDER BY ci.orden ASC
    `;

    return NextResponse.json({ data: { ...catalog, items } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
