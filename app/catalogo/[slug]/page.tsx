import { notFound } from "next/navigation";
import { PublicCatalogoClient } from "./client_page";
import { sql } from "@/lib/db";
import { filterProducts } from "@/api/catalogos/public/[slug]/filter-products";

export const dynamic = 'force-dynamic';

async function getCatalogData(slug: string) {
  try {
    const cats = await sql`
      SELECT c.*, e.slug as empresa_slug
      FROM catalogos c
      JOIN empresas e ON c.empresa_id = e.id
      WHERE c.slug = ${slug} AND c.activo = true
    `;
    if (cats.length === 0) return { status: 404, data: null };
    const cat = cats[0];

    const soloNuevo = cat.solo_nuevo;
    const margen = parseFloat(cat.margen_precio) || 0;
    const mostrarPrecio = cat.mostrar_precio;

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
      WHERE (${cat.ambas_empresas} = true OR p.empresa_id = ${cat.empresa_id})
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

    let productos = filterProducts(rows, codigosIncluir, keywordsIncluir, excluir);

    productos = productos.map((p: any) => ({
      ...p,
      saldo: parseInt(p.saldo),
      costo: parseFloat(p.costo),
      cantcaja: parseInt(p.cantcaja),
      precio_catalogo: mostrarPrecio
        ? Math.ceil(parseFloat(p.costo) * (1 + margen / 100) * 10) / 10
        : null,
    }));

    return {
      status: 200,
      data: {
        titulo: cat.titulo,
        descripcion: cat.descripcion,
        mostrar_precio: cat.mostrar_precio,
        empresa_slug: cat.empresa_slug,
        productos,
      }
    };
  } catch (e: any) {
    return { status: 500, data: null };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { data } = await getCatalogData(params.slug);
  return { title: `VidaDigital - ${data?.titulo || 'Catálogo'}` };
}

export default async function PublicCatalogoPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { status, data } = await getCatalogData(slug);
  if (status === 404) return notFound();
  if (status !== 200 || !data) {
    return <div className="p-8 text-center mt-20 font-bold text-red-500">Error cargando el catálogo.</div>;
  }

  return <PublicCatalogoClient data={data} />;
}
