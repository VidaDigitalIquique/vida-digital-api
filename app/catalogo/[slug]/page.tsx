import { notFound } from "next/navigation";
import { PublicCatalogoClient } from "./client_page";

export default async function PublicCatalogoPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const res = await fetch(
    `${process.env.NEXTAUTH_URL}/api/catalogos/public/${slug}`,
    { cache: 'no-store' }
  );

  if (res.status === 404) return notFound();
  if (!res.ok) return <div className="p-8 text-center mt-20 font-bold text-red-500">Error cargando el catálogo.</div>;

  const { data } = await res.json();

  return <PublicCatalogoClient data={data} />;
}
