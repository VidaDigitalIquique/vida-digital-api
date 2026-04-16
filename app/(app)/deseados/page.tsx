import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DeseadosClient } from './client_page';

export default async function DeseadosPage() {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    redirect('/dashboard');
  }

  return <DeseadosClient session={session.user} />;
}
