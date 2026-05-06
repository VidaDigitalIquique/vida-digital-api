import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { recalculateNuevoFlags } from '@/lib/services/product-service';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const sanjhResult = await sql`
      WITH upserted AS (
        INSERT INTO public.productos (
          empresa_id, codigo, nroingreso,
          saldo, cif, costo, cantcaja, pesocaja, cubicaja, umed, detalle,
          prcventa, prcminimo, imagen_url, public_id, categoria, es_nuevo,
          fecha_ingreso, updated_at
        )
        SELECT
          1, inv.codunico, inv.knumezet,
          inv.stocdisp, inv.cifunita, inv.cosunita, inv.cantcaja, inv.pesocaja, inv.cubicaja, inv.desunida, inv.descript,
          NULL, NULL, NULL, NULL,
          (SELECT categoria FROM public.productos WHERE codigo = inv.codunico AND empresa_id = 1 AND categoria IS NOT NULL LIMIT 1),
          false, NOW(), NOW()
        FROM sanjh.inventar inv
        ON CONFLICT ON CONSTRAINT productos_empresa_id_codigo_nroingreso_key
        DO UPDATE SET
          saldo      = EXCLUDED.saldo,
          cif        = EXCLUDED.cif,
          costo      = EXCLUDED.costo,
          cantcaja   = EXCLUDED.cantcaja,
          pesocaja   = EXCLUDED.pesocaja,
          cubicaja   = EXCLUDED.cubicaja,
          umed       = EXCLUDED.umed,
          updated_at = NOW()
        RETURNING id
      )
      SELECT COUNT(*)::int as count FROM upserted
    `;

    const vidaResult = await sql`
      WITH upserted AS (
        INSERT INTO public.productos (
          empresa_id, codigo, nroingreso,
          saldo, cif, costo, cantcaja, pesocaja, cubicaja, umed, detalle,
          prcventa, prcminimo, imagen_url, public_id, categoria, es_nuevo,
          fecha_ingreso, updated_at
        )
        SELECT
          2, inv.codunico, inv.knumezet,
          inv.stocdisp, inv.cifunita, inv.cosunita, inv.cantcaja, inv.pesocaja, inv.cubicaja, inv.desunida, inv.descript,
          NULL, NULL, NULL, NULL,
          (SELECT categoria FROM public.productos WHERE codigo = inv.codunico AND empresa_id = 2 AND categoria IS NOT NULL LIMIT 1),
          false, NOW(), NOW()
        FROM vida.inventar inv
        ON CONFLICT ON CONSTRAINT productos_empresa_id_codigo_nroingreso_key
        DO UPDATE SET
          saldo      = EXCLUDED.saldo,
          cif        = EXCLUDED.cif,
          costo      = EXCLUDED.costo,
          cantcaja   = EXCLUDED.cantcaja,
          pesocaja   = EXCLUDED.pesocaja,
          cubicaja   = EXCLUDED.cubicaja,
          umed       = EXCLUDED.umed,
          updated_at = NOW()
        RETURNING id
      )
      SELECT COUNT(*)::int as count FROM upserted
    `;

    const sanjh_count = Number(sanjhResult?.[0]?.count ?? 0);
    const vida_count = Number(vidaResult?.[0]?.count ?? 0);

    await recalculateNuevoFlags(1);
    await recalculateNuevoFlags(2);

    return NextResponse.json({
      message: 'Sincronizacion completada',
      sanjh_count,
      vida_count,
    });
  } catch (error: any) {
    console.error('POST /api/cron/sync-inventar error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
