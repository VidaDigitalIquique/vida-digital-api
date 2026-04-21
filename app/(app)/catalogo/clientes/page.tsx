import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CatalogoClientesClient } from './client_page';

export default async function CatalogoClientesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const rol = (session.user as any).rol;
  if (!['admin', 'vendedor'].includes(rol)) redirect('/dashboard');
  return <CatalogoClientesClient session={session} />;
}
