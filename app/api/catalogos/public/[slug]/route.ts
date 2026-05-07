import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { filterProducts, filterBySoloNuevo, type CatalogoProducto } from "./filter-products";

export const dynamic = 'force-dynamic';

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
    const tokens = cat.palabras_incluir
      ? cat.palabras_incluir.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    let codigosIncluir: string[] = [];
    let keywordsIncluir: string[] = [];

    if (tokens.length > 0) {
      const tokensUpper = tokens.map((t: string) => t.toUpperCase());
      const found = await sql`
        SELECT DISTINCT UPPER(codigo) as codigo
        FROM productos
        WHERE UPPER(codigo) = ANY(${tokensUpper})
      `;
      const codigosEncontrados = new Set(found.map((r: any) => r.codigo));
      codigosIncluir = tokensUpper.filter((t: string) => codigosEncontrados.has(t));
      keywordsIncluir = tokens
        .filter((t: string) => !codigosEncontrados.has(t.toUpperCase()))
        .map((t: string) => t.toLowerCase());
    }

    const excluir = cat.palabras_excluir
      ? cat.palabras_excluir.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      : [];

    const categoriaFilter = cat.categoria;

    const rows = categoriaFilter
      ? await sql`
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
          WHERE (${cat.ambas_empresas} = true OR p.empresa_id = ${cat.empresa_id})
            AND p.categoria = ${categoriaFilter}
          GROUP BY p.codigo
          ORDER BY p.codigo ASC
        `
      : await sql`
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
          WHERE (${cat.ambas_empresas} = true OR p.empresa_id = ${cat.empresa_id})
          GROUP BY p.codigo
          ORDER BY p.codigo ASC
        `;

    // Apply keyword filters in JS (simpler than complex SQL)
    let productos = filterProducts(rows as CatalogoProducto[], codigosIncluir, keywordsIncluir, excluir);

    if (soloStock) {
      productos = productos.filter((p: any) => Number(p.saldo) > 0);
    }
    if (soloNuevo) {
      // Último ingreso real: prefijo 101, folio más alto del año más alto.
      // No usa fecha_ingreso (que es fecha de sync, no de ingreso real a Zofri).
      const latestIngreso = cat.ambas_empresas
        ? await sql`
            SELECT SPLIT_PART(nroingreso,'-',2) as anio, SPLIT_PART(nroingreso,'-',3) as folio
            FROM productos
            WHERE nroingreso IS NOT NULL
              AND nroingreso NOT LIKE 'INICIAL%'
              AND SPLIT_PART(nroingreso,'-',1) = '101'
            ORDER BY SPLIT_PART(nroingreso,'-',2) DESC, SPLIT_PART(nroingreso,'-',3)::integer DESC
            LIMIT 1
          `
        : await sql`
            SELECT SPLIT_PART(nroingreso,'-',2) as anio, SPLIT_PART(nroingreso,'-',3) as folio
            FROM productos
            WHERE empresa_id = ${cat.empresa_id}
              AND nroingreso IS NOT NULL
              AND nroingreso NOT LIKE 'INICIAL%'
              AND SPLIT_PART(nroingreso,'-',1) = '101'
            ORDER BY SPLIT_PART(nroingreso,'-',2) DESC, SPLIT_PART(nroingreso,'-',3)::integer DESC
            LIMIT 1
          `;

      const latestAnio = latestIngreso[0]?.anio as string | undefined;
      const latestFolio = latestIngreso[0]?.folio as string | undefined;
      let latestCodigos = new Set<string>();

      if (latestAnio && latestFolio) {
        const pattern = `101-${latestAnio}-${latestFolio}-%`;
        const codigoRows = cat.ambas_empresas
          ? await sql`SELECT DISTINCT UPPER(codigo) as codigo FROM productos WHERE nroingreso LIKE ${pattern}`
          : await sql`SELECT DISTINCT UPPER(codigo) as codigo FROM productos WHERE empresa_id = ${cat.empresa_id} AND nroingreso LIKE ${pattern}`;
        latestCodigos = new Set(codigoRows.map((r: any) => r.codigo as string));
      }

      productos = filterBySoloNuevo(productos, latestCodigos);
    }

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
