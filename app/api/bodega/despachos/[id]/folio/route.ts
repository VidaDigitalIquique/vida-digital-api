import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  const userEmpresas: number[] = ((session.user as any)?.empresas || []) as number[];
  const usuarioNombre = String((session.user as any)?.nombre || '');

  const body = await req.json().catch(() => ({}));
  const folioNuevo: string = body?.folio_nuevo?.trim() ?? '';

  if (!folioNuevo || !/^\d+$/.test(folioNuevo)) {
    return NextResponse.json({ error: 'folio inválido' }, { status: 400 });
  }

  const despachoRows = await sql`
    SELECT id, folio, empresa_id
    FROM public.despachos_bodega
    WHERE id = ${id}
  `;
  const despacho = (despachoRows as any[])[0];

  // 404 tanto para "no existe" como "no es de su empresa" (no filtrar existencia)
  if (!despacho) return NextResponse.json({ error: 'Despacho no encontrado' }, { status: 404 });
  if (!userEmpresas.includes(despacho.empresa_id)) {
    return NextResponse.json({ error: 'Despacho no encontrado' }, { status: 404 });
  }

  const folioAnterior: string = despacho.folio;
  if (folioAnterior === folioNuevo) {
    return NextResponse.json({ error: 'El folio es el mismo' }, { status: 400 });
  }

  await sql`
    UPDATE public.despachos_bodega
    SET folio = ${folioNuevo}
    WHERE id = ${id}
  `;

  const auditRows = await sql`
    INSERT INTO public.despachos_bodega_folio_audit
      (despacho_id, folio_anterior, folio_nuevo, corregido_por)
    VALUES
      (${id}, ${folioAnterior}, ${folioNuevo}, ${usuarioNombre})
    RETURNING corregido_en
  `;
  const corregidoEn = (auditRows as any[])[0]?.corregido_en;

  return NextResponse.json({
    id,
    folio_anterior: folioAnterior,
    folio_nuevo: folioNuevo,
    corregido_por: usuarioNombre,
    corregido_en: corregidoEn,
  });
}
