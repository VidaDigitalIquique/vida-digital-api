import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = params;
  const result = await sql`DELETE FROM deuda_pagos WHERE id = ${id} RETURNING id`;
  if (result.length === 0)
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
