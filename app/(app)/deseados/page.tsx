import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DeseadosClient } from './client_page';

export default async function DeseadosPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return <DeseadosClient session={session.user as any} />;
}
