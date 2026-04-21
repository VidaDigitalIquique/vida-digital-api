import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: { kcodclie: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kcodclie } = params;

  const rows = await sql`
    SELECT estrellas FROM public.cliente_ratings WHERE kcodclie = ${kcodclie}
  `;

  if (rows.length > 0) {
    return NextResponse.json({ estrellas: Number(rows[0].estrellas) });
  }

  return NextResponse.json({ estrellas: 0 });
}
