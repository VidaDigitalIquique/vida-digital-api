import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sql } from '@/lib/db';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await sql`
    SELECT
      cs.id,
      cs.kcodclie,
      cs.empresa_id,
      cs.nombre_winfac,
      cs.score,
      cs.estado,
      cs.created_at,
      cd.nombre AS nombre_lead,
      cd.whatsapp AS whatsapp_lead
    FROM public.conversion_sugerencias cs
    JOIN public.clientes_deseados cd ON cd.id = cs.cliente_deseado_id
    WHERE cs.estado = 'pendiente'
    ORDER BY cs.score DESC, cs.created_at DESC
  `;

  return NextResponse.json({ data: rows });
}
