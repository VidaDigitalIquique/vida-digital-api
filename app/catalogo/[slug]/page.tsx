import { notFound } from "next/navigation";
import { PublicCatalogoClient } from "./client_page";

async function getCatalogData(slug: string) {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL}/api/catalogos/public/${slug}`,
    { cache: 'no-store' }
  );

  if (res.status === 404) return { status: 404, data: null };
  if (!res.ok) return { status: res.status, data: null };

  const { data } = await res.json();
  return { status: 200, data };
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
