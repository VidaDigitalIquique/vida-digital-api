import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;

  try {
    const cats = await sql`
      SELECT c.*, e.slug as empresa_slug
      FROM catalogos c
      JOIN empresas e ON c.empresa_id = e.id
      WHERE c.slug = ${slug} AND c.activo = true
    `;

    if (cats.length === 0) return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 });
    const cat = cats[0];

    // Build dynamic filters
    const soloStock = cat.solo_stock;
    const soloNuevo = cat.solo_nuevo;
    const margen = parseFloat(cat.margen_precio) || 0;
    const mostrarPrecio = cat.mostrar_precio;

    // Parse keyword filters
    const incluir = cat.palabras_incluir
      ? cat.palabras_incluir.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      : [];
    const excluir = cat.palabras_excluir
      ? cat.palabras_excluir.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      : [];

    // Query products with physical availability filter (OBLIGATORIO)
    const rows = await sql`
      SELECT
        p.codigo,
        MAX(p.id) as id,
        MAX(p.detalle) as detalle,
        MAX(p.imagen_url) as imagen_url,
        MAX(p.cantcaja) as cantcaja,
        MAX(p.umed) as umed,
        MAX(p.costo) as costo,
        SUM(p.saldo) as saldo,
        BOOL_OR(p.es_nuevo) as es_nuevo
      FROM productos p
      WHERE p.empresa_id = ${cat.empresa_id}
        AND p.saldo > 0
        AND (${soloNuevo} = false OR p.es_nuevo = true)
        AND EXISTS (
          SELECT 1 FROM ubicaciones_bodega ub
          WHERE ub.empresa_id = p.empresa_id
            AND ub.codigo = p.codigo
            AND ub.fisico IS NOT NULL
            AND ub.diferencia >= 0
        )
      GROUP BY p.codigo
      ORDER BY p.codigo ASC
    `;
    console.log('DEBUG rows count:', rows.length, 'empresa_id:', cat.empresa_id);

    // Apply keyword filters in JS (simpler than complex SQL)
    let productos = rows.filter((p: any) => {
      const haystack = `${p.codigo} ${p.detalle || ''}`.toLowerCase();

      if (incluir.length > 0) {
        const matchesIncluir = incluir.some((kw: string) => haystack.includes(kw));
        if (!matchesIncluir) return false;
      }

      if (excluir.length > 0) {
        const matchesExcluir = excluir.some((kw: string) => haystack.includes(kw));
        if (matchesExcluir) return false;
      }

      return true;
    });

    // Compute precio_catalogo
    productos = productos.map((p: any) => ({
      ...p,
      saldo: parseInt(p.saldo),
      costo: parseFloat(p.costo),
      cantcaja: parseInt(p.cantcaja),
      precio_catalogo: mostrarPrecio
        ? Math.ceil(parseFloat(p.costo) * (1 + margen / 100) * 10) / 10
        : null,
    }));

    return NextResponse.json({
      data: {
        titulo: cat.titulo,
        descripcion: cat.descripcion,
        mostrar_precio: cat.mostrar_precio,
        empresa_slug: cat.empresa_slug,
        productos,
      }
    });
  } catch (error: any) {
    console.error("GET /api/catalogos/public/[slug] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
