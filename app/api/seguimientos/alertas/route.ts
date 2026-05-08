import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  try {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int as count
      FROM public.seguimientos s
      WHERE EXISTS (
        SELECT 1 FROM public.seguimiento_interacciones si WHERE si.seguimiento_id = s.id
      )
      AND (
        (
          (SELECT si.proximo_contacto
           FROM public.seguimiento_interacciones si
           WHERE si.seguimiento_id = s.id
           ORDER BY si.created_at DESC LIMIT 1) < CURRENT_DATE
        )
        OR
        (
          NOT EXISTS (
            SELECT 1 FROM public.seguimiento_interacciones si
            WHERE si.seguimiento_id = s.id AND si.proximo_contacto IS NOT NULL
          )
          AND (
            SELECT MAX(si.created_at)
            FROM public.seguimiento_interacciones si
            WHERE si.seguimiento_id = s.id
          ) < NOW() - INTERVAL '7 days'
        )
      )`;
    return NextResponse.json({ count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
