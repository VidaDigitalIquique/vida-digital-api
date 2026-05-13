import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ImportarClient } from "./client_page";
import { redirect } from "next/navigation";
import { sql } from '@/lib/db';

export default async function ImportarPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !['admin', 'supervisor', 'vendedor'].includes((session.user as any).rol)) {
    redirect('/dashboard');
  }
  const rol = (session.user as any).rol;

  const rows = await sql`
    SELECT empresa_id, MAX(updated_at) as last_sync
    FROM public.productos
    WHERE empresa_id IN (1, 2)
    GROUP BY empresa_id
  `;
  const lastSyncSanjh = rows.find(r => r.empresa_id === 1)?.last_sync ?? null;
  const lastSyncVida = rows.find(r => r.empresa_id === 2)?.last_sync ?? null;

  return <ImportarClient lastSyncSanjh={lastSyncSanjh} lastSyncVida={lastSyncVida} rol={rol} />;
}
