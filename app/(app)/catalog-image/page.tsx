import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CatalogImageGenerator } from '@/components/catalog-image/CatalogImageGenerator';

export const dynamic = 'force-dynamic';

export default async function CatalogImagePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const rol = (session.user as any).rol;
  if (!['admin', 'vendedor'].includes(rol)) {
    return (
      <div className="p-8 text-center mt-20 font-bold text-red-500">
        Acceso restringido a administradores y vendedores.
      </div>
    );
  }

  return <CatalogImageGenerator />;
}
