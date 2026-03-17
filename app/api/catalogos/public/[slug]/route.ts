import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

// Public endpoint, no authentication required.
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;

  try {
    const catalogRows = await sql`SELECT * FROM catalogos WHERE slug = ${slug}`;
    if (catalogRows.length === 0) return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 });

    const catalog = catalogRows[0];

    if (!catalog.activo) {
      return NextResponse.json({ error: "Este catálogo ya no está disponible" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const withItems = searchParams.get('items') === 'true';

    let items: any[] = [];
    if (withItems) {
      // Fetch items and inject enterprise slug for Cloudinary fallback
      items = await sql`
        SELECT 
          ci.*,
          p.codigo as producto_codigo,
          p.detalle as producto_detalle,
          p.imagen_url as producto_imagen_url,
          p.prcventa,
          p.es_nuevo,
          p.saldo,
          p.umed,
          e.slug as empresa_slug
        FROM catalogo_items ci
        LEFT JOIN productos p ON ci.producto_id = p.id
        LEFT JOIN empresas e ON p.empresa_id = e.id
        WHERE ci.catalogo_id = ${catalog.id}
        ORDER BY ci.orden ASC
      `;
    }

    return NextResponse.json({ data: { ...catalog, items } });

  } catch (error: any) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
