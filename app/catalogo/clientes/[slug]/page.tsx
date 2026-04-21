import { notFound } from "next/navigation";
import { PublicCatalogoClient } from "@/app/catalogo/[slug]/client_page";

export const dynamic = 'force-dynamic';

async function getCatalogoClienteData(slug: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/catalogos/cliente/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { status: res.status, data: null };
    const json = await res.json();
    return { status: 200, data: json.data };
  } catch {
    return { status: 500, data: null };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { data } = await getCatalogoClienteData(params.slug);
  return { title: `VidaDigital - ${data?.titulo || 'Catálogo Cliente'}` };
}

export default async function PublicCatalogoClientePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { status, data } = await getCatalogoClienteData(slug);
  if (status === 404) return notFound();
  if (status !== 200 || !data) {
    return <div className="p-8 text-center mt-20 font-bold text-red-500">Error cargando el catálogo.</div>;
  }
  return <PublicCatalogoClient data={data} />;
}
