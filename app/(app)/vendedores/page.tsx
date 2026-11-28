import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import flags from '@/config/feature-flags.json';
import { puedeEditarComisionPct, puedeVerGananciaVendedores, puedeVerVendedores } from '@/lib/roles';
import { VendedoresClient } from './VendedoresClient';
import { ComisionesPanel } from './ComisionesPanel';
import { GananciaPeriodoPanel } from './GananciaPeriodoPanel';

export const dynamic = 'force-dynamic';

export default async function VendedoresPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const rol = (session.user as unknown as { rol?: string })?.rol;
  if (!puedeVerVendedores(rol)) redirect('/dashboard');
  if (!flags['vendedores-modulo']) notFound();
  const verGanancia = puedeVerGananciaVendedores(rol);
  return (
    <div className="container max-w-7xl mx-auto px-4 py-6">
      <VendedoresClient
        puedeVerDetalle={verGanancia}
        buscadorActivo={flags['vendedores-buscador']}
        buscadorCodigoActivo={flags['vendedores-buscador-codigo']}
      />
      {verGanancia && flags['vendedores-ganancia-periodo'] && <GananciaPeriodoPanel />}
      <ComisionesPanel
        puedeEditarPct={puedeEditarComisionPct(rol)}
        mostrarMargen={verGanancia && Boolean(flags['vendedores-comisiones-margen'])}
      />
    </div>
  );
}
