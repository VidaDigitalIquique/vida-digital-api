import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import flags from '@/config/feature-flags.json';
import { puedeVerVendedores } from '@/lib/roles';
import { VendedoresClient } from './VendedoresClient';

export const dynamic = 'force-dynamic';

export default async function VendedoresPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const rol = (session.user as unknown as { rol?: string })?.rol;
  if (!puedeVerVendedores(rol)) redirect('/dashboard');
  if (!flags['vendedores-modulo']) notFound();
  return (
    <div className="container max-w-7xl mx-auto px-4 py-6">
      <VendedoresClient />
    </div>
  );
}
