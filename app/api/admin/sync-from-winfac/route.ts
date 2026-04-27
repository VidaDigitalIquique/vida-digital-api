import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { recalculateNuevoFlags } from '@/lib/services/product-service';
import { syncClientRatings } from '@/lib/sync-client-ratings';
import { syncClientesNuevos } from '@/lib/sync-clientes-nuevos';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'supervisor'].includes((session.user as any).rol)) {
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
          (SELECT categoria FROM public.productos
           WHERE codigo = inv.codunico
             AND empresa_id = 1
             AND categoria IS NOT NULL
           LIMIT 1),
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
          (SELECT categoria FROM public.productos
           WHERE codigo = inv.codunico
             AND empresa_id = 2
             AND categoria IS NOT NULL
           LIMIT 1),
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

    // Sync saldo y cantcaja en ubicaciones_bodega desde public.productos (empresa 1 - sanjh)
    await sql`
      INSERT INTO ubicaciones_bodega (empresa_id, codigo, nroingreso, detalle, saldo, cantcaja)
      SELECT p.empresa_id, p.codigo, p.nroingreso, p.detalle, p.saldo, p.cantcaja
      FROM public.productos p
      WHERE p.empresa_id = 1
      ON CONFLICT ON CONSTRAINT ubicaciones_bodega_empresa_id_codigo_nroingreso_key
      DO UPDATE SET
        saldo = EXCLUDED.saldo,
        cantcaja = EXCLUDED.cantcaja,
        detalle = EXCLUDED.detalle,
        updated_at = NOW()
    `;

    // Sync saldo y cantcaja en ubicaciones_bodega desde public.productos (empresa 2 - vida)
    await sql`
      INSERT INTO ubicaciones_bodega (empresa_id, codigo, nroingreso, detalle, saldo, cantcaja)
      SELECT p.empresa_id, p.codigo, p.nroingreso, p.detalle, p.saldo, p.cantcaja
      FROM public.productos p
      WHERE p.empresa_id = 2
      ON CONFLICT ON CONSTRAINT ubicaciones_bodega_empresa_id_codigo_nroingreso_key
      DO UPDATE SET
        saldo = EXCLUDED.saldo,
        cantcaja = EXCLUDED.cantcaja,
        detalle = EXCLUDED.detalle,
        updated_at = NOW()
    `;

    const alertasResult = await sql`
      UPDATE public.productos_deseados
      SET alerta_activa = true, alerta_generada_at = NOW(), updated_at = NOW()
      WHERE estado = 'pendiente'
        AND alerta_activa = false
        AND codigo IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.productos p
          WHERE p.codigo = productos_deseados.codigo AND p.saldo > 0
        )
      RETURNING id
    `;
    const alertas_generadas = alertasResult.length;

    const stockBajoVida = await sql`
      WITH stock_grouped AS (
        SELECT
          codigo,
          empresa_id,
          MAX(detalle) as detalle,
          SUM(saldo)::int as saldo_total,
          MAX(cantcaja)::int as cantcaja,
          BOOL_OR(no_reponer) as no_reponer
        FROM public.productos
        WHERE empresa_id = 2 AND cantcaja > 0
        GROUP BY codigo, empresa_id
      )
      INSERT INTO public.alertas_stock_bajo (codigo, empresa_id, detalle, saldo, cantcaja)
      SELECT codigo, empresa_id, detalle, saldo_total, cantcaja
      FROM stock_grouped
      WHERE saldo_total >= 0
        AND saldo_total <= cantcaja
        AND no_reponer = false
      ON CONFLICT (codigo, empresa_id) DO UPDATE SET
        saldo = EXCLUDED.saldo,
        detalle = EXCLUDED.detalle,
        activa = true,
        updated_at = NOW()
      RETURNING id
    `;

    await sql`
      UPDATE public.alertas_stock_bajo asb
      SET activa = false, updated_at = NOW()
      WHERE activa = true
        AND EXISTS (
          SELECT 1 FROM (
            SELECT codigo, empresa_id, SUM(saldo) as saldo_total, MAX(cantcaja) as cantcaja
            FROM public.productos
            GROUP BY codigo, empresa_id
          ) p
          WHERE p.codigo = asb.codigo
            AND p.empresa_id = asb.empresa_id
            AND p.saldo_total > p.cantcaja
        )
    `;

    const stockBajoSanjh = await sql`
      WITH stock_grouped AS (
        SELECT
          codigo,
          empresa_id,
          MAX(detalle) as detalle,
          SUM(saldo)::int as saldo_total,
          MAX(cantcaja)::int as cantcaja,
          BOOL_OR(no_reponer) as no_reponer
        FROM public.productos
        WHERE empresa_id = 1 AND cantcaja > 0
        GROUP BY codigo, empresa_id
      )
      INSERT INTO public.alertas_stock_bajo (codigo, empresa_id, detalle, saldo, cantcaja)
      SELECT codigo, empresa_id, detalle, saldo_total, cantcaja
      FROM stock_grouped
      WHERE saldo_total >= 0
        AND saldo_total <= cantcaja
        AND no_reponer = false
      ON CONFLICT (codigo, empresa_id) DO UPDATE SET
        saldo = EXCLUDED.saldo,
        detalle = EXCLUDED.detalle,
        activa = true,
        updated_at = NOW()
      RETURNING id
    `;

    await recalculateNuevoFlags(1);
    await recalculateNuevoFlags(2);

    await syncClientRatings(sql);
    await syncClientesNuevos(sql);

    return NextResponse.json({
      message: 'Sincronizacion completada con exito',
      sanjh_count,
      vida_count,
      alertas_generadas,
      alertas_stock_bajo: stockBajoVida.length + stockBajoSanjh.length,
    });
  } catch (error: any) {
    console.error('POST /api/admin/sync-from-winfac error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
