import { sql } from "@/lib/db";
import { notFound } from "next/navigation";
import { PublicCatalogoClient } from "./client_page";

export default async function PublicCatalogoPage({ params }: { params: { slug: string } }) {
  // Server fetch to render immediately the shell and initial data
  // Even though it's public, doing it Server-Side improves SEO heavily
  const { slug } = params;

  // We reuse the same query logic as our public API endpoint directly here 
  // to serve the Next.js standard Server Component pattern correctly.
  
  const catalogRows = await sql`SELECT * FROM catalogos WHERE slug = ${slug}`;
  if (catalogRows.length === 0) return notFound();

  const catalog = catalogRows[0];
  if (!catalog.activo) return <div className="p-8 text-center mt-20 font-bold text-red-500">Este catálogo ya no está disponible.</div>;

  const items = await sql`
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

  const payload = { ...catalog, items };

  return <PublicCatalogoClient data={payload} />;
}
