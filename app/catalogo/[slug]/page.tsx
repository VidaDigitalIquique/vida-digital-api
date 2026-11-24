import { notFound } from "next/navigation";
import { PublicCatalogoClient } from "./client_page";
import { getCatalogData } from "./catalog-data";

export const dynamic = 'force-dynamic';

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
