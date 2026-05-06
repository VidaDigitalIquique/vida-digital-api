import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CatalogImageClient } from './client';

export default async function CatalogImagePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <CatalogImageClient />;
}
