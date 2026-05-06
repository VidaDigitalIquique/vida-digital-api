import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const usuarioId = searchParams.get('usuario_id');
  if (!usuarioId)
    return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 });

  const prestamos = await sql`
    SELECT NULL::int AS pago_id, d.id AS deuda_id, d.tipo, d.monto, d.descripcion,
           d.solicitado_at AS fecha_hora, 'deuda' AS item_tipo
    FROM deudas_solicitudes d
    WHERE d.user_id = ${usuarioId} AND d.tipo = 'prestamo'
    UNION ALL
    SELECT dp.id AS pago_id, dp.deuda_id, 'pago' AS tipo, dp.monto, NULL AS descripcion,
           dp.fecha_hora, 'pago' AS item_tipo
    FROM deuda_pagos dp
    JOIN deudas_solicitudes d ON d.id = dp.deuda_id
    WHERE d.user_id = ${usuarioId} AND d.tipo = 'prestamo'
    ORDER BY fecha_hora DESC
  `;

  const adelantos = await sql`
    SELECT NULL::int AS pago_id, d.id AS deuda_id, d.tipo, d.monto, d.descripcion,
           d.solicitado_at AS fecha_hora, 'deuda' AS item_tipo
    FROM deudas_solicitudes d
    WHERE d.user_id = ${usuarioId} AND d.tipo IN ('adelanto', 'quincena')
    UNION ALL
    SELECT dp.id AS pago_id, dp.deuda_id, 'pago' AS tipo, dp.monto, NULL AS descripcion,
           dp.fecha_hora, 'pago' AS item_tipo
    FROM deuda_pagos dp
    JOIN deudas_solicitudes d ON d.id = dp.deuda_id
    WHERE d.user_id = ${usuarioId} AND d.tipo IN ('adelanto', 'quincena')
    ORDER BY fecha_hora DESC
  `;

  return NextResponse.json({ prestamos, adelantos });
}
