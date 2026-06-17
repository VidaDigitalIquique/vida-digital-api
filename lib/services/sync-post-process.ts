import { syncClientRatings } from '@/lib/sync-client-ratings';
import { syncClientesNuevos } from '@/lib/sync-clientes-nuevos';

export async function syncPostProcess(sql: any) {
  // ── Sync ubicaciones_bodega empresa 1 (Sanjh) ──────────────────────
  const ubicacionesSanjh = await sql`
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
    RETURNING id
  `;

  // ── Sync ubicaciones_bodega empresa 2 (Vida) ───────────────────────
  const ubicacionesVida = await sql`
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
    RETURNING id
  `;

  // ── Activar alertas en productos_deseados ───────────────────────────
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

  // ── Stock bajo Vida (empresa 2) ────────────────────────────────────
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

  // ── Desactivar alertas donde el stock ya se recuperó ────────────────
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

  // ── Stock bajo Sanjh (empresa 1) ───────────────────────────────────
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

  // ── Sync clients ────────────────────────────────────────────────────
  const clientRatings = await syncClientRatings(sql);
  const clientesNuevos = await syncClientesNuevos(sql);

  // ── Retorno ─────────────────────────────────────────────────────────
  return {
    ubicaciones_sanjh: ubicacionesSanjh.length,
    ubicaciones_vida: ubicacionesVida.length,
    alertas_generadas: alertasResult.length,
    alertas_stock_bajo: stockBajoVida.length + stockBajoSanjh.length,
    client_ratings: clientRatings,
    clientes_nuevos: clientesNuevos,
  };
}
