import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function guard(session: any) {
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  const { searchParams } = new URL(request.url);
  const knumfoli = searchParams.get('knumfoli')?.trim();

  if (!knumfoli) {
    return NextResponse.json({ cliente: null });
  }

  try {
    // Buscar en vida (sin pestadot)
    const vidaRows = await sql`
      SELECT c.nombress as cliente
      FROM vida.movidcto m
      JOIN vida.clientes c ON c.kcodclie = m.kcodclie
      WHERE m.knumfoli = ${knumfoli}
      LIMIT 1
    `;

    if (vidaRows.length > 0) {
      return NextResponse.json({ cliente: vidaRows[0].cliente });
    }

    // Fallback a sanjh
    const sanjhRows = await sql`
      SELECT c.nombress as cliente
      FROM sanjh.movidcto m
      JOIN sanjh.clientes c ON c.kcodclie = m.kcodclie
      WHERE m.knumfoli = ${knumfoli}
      LIMIT 1
    `;

    if (sanjhRows.length > 0) {
      return NextResponse.json({ cliente: sanjhRows[0].cliente });
    }

    return NextResponse.json({ cliente: null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
