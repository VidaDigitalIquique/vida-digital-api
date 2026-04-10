import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DespachosClient } from './client_page';

export default async function DespachosPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const empresaId = (session.user as any)?.empresas?.[0] ?? 1;

  return <DespachosClient session={session as any} empresaId={empresaId} />;
}
