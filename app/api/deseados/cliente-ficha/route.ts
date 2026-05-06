import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const clienteDeseadoId = searchParams.get('cliente_deseado_id');
  const kcodclie = searchParams.get('kcodclie');

  if (!clienteDeseadoId && !kcodclie)
    return NextResponse.json({ error: 'Parámetro requerido' }, { status: 400 });

  if (clienteDeseadoId) {
    const rows = await sql`
      SELECT nombre, whatsapp, ciudad, pais, notas
      FROM clientes_deseados WHERE id = ${clienteDeseadoId}
    `;
    if (rows.length === 0)
      return NextResponse.json({ error: 'no_encontrado' }, { status: 404 });
    const r = rows[0];
    return NextResponse.json({
      nombre: r.nombre, telefono: null,
      whatsapp: r.whatsapp ?? null, ciudad: r.ciudad ?? null,
      pais: r.pais ?? null, notas: r.notas ?? null, fuente: 'nuevo',
    });
  }

  const rows = await sql`
    SELECT kcodclie, nombress, celular, ciudad, pais
    FROM vida.clientes WHERE kcodclie = ${kcodclie}
  `;
  if (rows.length === 0)
    return NextResponse.json({ error: 'no_encontrado' }, { status: 404 });
  const r = rows[0];
  return NextResponse.json({
    nombre: r.nombress, telefono: r.celular ?? null,
    whatsapp: null, ciudad: r.ciudad ?? null,
    pais: r.pais ?? null, notas: null, fuente: 'winfac',
  });
}
