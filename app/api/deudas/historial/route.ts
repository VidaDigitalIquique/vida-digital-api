import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

const byFecha = (a: any, b: any) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const usuarioId = searchParams.get('usuario_id');
  if (!usuarioId)
    return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 });

  // Deudas: siempre disponibles
  const prestamoDeudas = await sql`
    SELECT NULL::int AS pago_id, d.id AS deuda_id, d.tipo, d.monto, d.descripcion,
           d.solicitado_at AS fecha_hora, d.estado, 'deuda' AS item_tipo
    FROM deudas_solicitudes d
    WHERE d.user_id = ${usuarioId} AND d.tipo = 'prestamo'
  `;

  const adelantoDeudas = await sql`
    SELECT NULL::int AS pago_id, d.id AS deuda_id, d.tipo, d.monto, d.descripcion,
           d.solicitado_at AS fecha_hora, d.estado, 'deuda' AS item_tipo
    FROM deudas_solicitudes d
    WHERE d.user_id = ${usuarioId} AND d.tipo IN ('adelanto', 'quincena')
  `;

  // Pagos: pueden fallar si la migración 005 aún no se ejecutó en la BD
  let prestamoPagos: any[] = [];
  let adelantoPagos: any[] = [];
  try {
    [prestamoPagos, adelantoPagos] = await Promise.all([
      sql`
        SELECT dp.id AS pago_id, dp.deuda_id, 'pago' AS tipo, dp.monto, NULL AS descripcion,
               dp.fecha_hora, 'pago' AS item_tipo
        FROM deuda_pagos dp
        JOIN deudas_solicitudes d ON d.id = dp.deuda_id
        WHERE d.user_id = ${usuarioId} AND d.tipo = 'prestamo'
      `,
      sql`
        SELECT dp.id AS pago_id, dp.deuda_id, 'pago' AS tipo, dp.monto, NULL AS descripcion,
               dp.fecha_hora, 'pago' AS item_tipo
        FROM deuda_pagos dp
        JOIN deudas_solicitudes d ON d.id = dp.deuda_id
        WHERE d.user_id = ${usuarioId} AND d.tipo IN ('adelanto', 'quincena')
      `,
    ]);
  } catch { /* columna fecha_hora aún no existe: se muestran solo las deudas */ }

  return NextResponse.json({
    prestamos: [...prestamoDeudas, ...prestamoPagos].sort(byFecha),
    adelantos: [...adelantoDeudas, ...adelantoPagos].sort(byFecha),
  });
}
