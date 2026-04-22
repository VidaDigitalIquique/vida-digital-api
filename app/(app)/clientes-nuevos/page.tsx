import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ClientesNuevosPage } from './client_page';

export default async function ClientesNuevosRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const rol = (session.user as any).rol;
  if (!['admin', 'vendedor', 'supervisor'].includes(rol)) redirect('/dashboard');
  return <ClientesNuevosPage session={session} />;
}
