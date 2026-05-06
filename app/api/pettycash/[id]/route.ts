import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const PettycashUpdateSchema = z.object({
  tipo:     z.enum(['ingreso', 'egreso']).optional(),
  concepto: z.string().min(1).max(255).optional(),
  monto:    z.number().positive().optional(),
  fecha:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(data => Object.keys(data).length > 0, 'Sin campos a actualizar');

function adminGuard(session: any) {
  if (!session)
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if ((session.user as any).rol !== 'admin')
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const { id } = params;
  const body = await request.json();
  const parsed = PettycashUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { tipo, concepto, monto, fecha } = parsed.data;

  const rows = await sql`
    UPDATE pettycash_movimientos
    SET
      tipo     = COALESCE(${tipo ?? null}, tipo),
      concepto = COALESCE(${concepto ?? null}, concepto),
      monto    = COALESCE(${monto ?? null}::numeric, monto),
      fecha    = COALESCE(${fecha ?? null}::date, fecha)
    WHERE id = ${id}
    RETURNING *
  `;

  if (rows.length === 0)
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const { id } = params;
  const rows = await sql`
    DELETE FROM pettycash_movimientos WHERE id = ${id} RETURNING id
  `;

  if (rows.length === 0)
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

  return NextResponse.json({ message: 'Eliminado', id: rows[0].id });
}
