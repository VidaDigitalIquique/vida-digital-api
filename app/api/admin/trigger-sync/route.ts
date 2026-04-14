import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'supervisor'].includes((session.user as any).rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const user = session.user as any;
  const solicitadoPor: string = user.name || user.email || 'desconocido';

  try {
    const insertResult = await sql`
      INSERT INTO public.sync_requests (estado, solicitado_por)
      VALUES ('pendiente', ${solicitadoPor})
      RETURNING id
    `;

    const start = Date.now();
    const requestId = insertResult[0].id;

    while (Date.now() - start < 90000) {
      await new Promise(r => setTimeout(r, 2000));
      const check = await sql`
        SELECT completed_at FROM public.sync_requests
        WHERE id = ${requestId}
      `;
      if (check[0]?.completed_at) {
        return NextResponse.json({ ok: true, elapsed_ms: Date.now() - start });
      }
    }

    return NextResponse.json({ error: 'timeout' }, { status: 504 });
  } catch (error: any) {
    console.error('POST /api/admin/trigger-sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
