import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NotaConPagos, PagoDetalle, ResumenClienteResponse } from "@/docs/specs/caja-mayor.spec";

function guard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: { kcodcli2: string } }
) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  const kcodcli2 = parseInt(params.kcodcli2, 10);
  if (isNaN(kcodcli2)) {
    return NextResponse.json({ error: "kcodcli2 inválido" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(_request.url);
    const estado = searchParams.get("estado") || "todas";

    // Fetch notas with payment detail from both empresas (parallel)
    const [vidaRows, sanjhRows] = await Promise.all([
      sql`
        SELECT
          m.knumfoli,
          m.fechanvt::text,
          m.val_rea,
          cmn.id AS pago_id,
          cmn.monto_aplicado AS pago_monto_usd,
          cmn.movimiento_id AS pago_mov_id,
          cmov.fecha::text AS pago_fecha,
          cmov.monto AS pago_monto_original,
          cmov.moneda AS pago_moneda_original,
          cmov.tipo_cambio AS pago_tipo_cambio,
          cmov.forma_pago AS pago_forma_pago
        FROM vida.movidcto m
        LEFT JOIN caja_movimiento_notas cmn
          ON cmn.empresa = 'vida' AND cmn.knumfoli = m.knumfoli::text
        LEFT JOIN caja_movimientos cmov
          ON cmov.id = cmn.movimiento_id
        WHERE m.kcodcli2 = ${kcodcli2} AND m.tipomovi = 'V'
        ORDER BY m.fechanvt ASC, cmov.fecha ASC
      `,
      sql`
        SELECT
          m.knumfoli,
          m.fechanvt::text,
          m.val_rea,
          cmn.id AS pago_id,
          cmn.monto_aplicado AS pago_monto_usd,
          cmn.movimiento_id AS pago_mov_id,
          cmov.fecha::text AS pago_fecha,
          cmov.monto AS pago_monto_original,
          cmov.moneda AS pago_moneda_original,
          cmov.tipo_cambio AS pago_tipo_cambio,
          cmov.forma_pago AS pago_forma_pago
        FROM sanjh.movidcto m
        LEFT JOIN caja_movimiento_notas cmn
          ON cmn.empresa = 'sanjh' AND cmn.knumfoli = m.knumfoli::text
        LEFT JOIN caja_movimientos cmov
          ON cmov.id = cmn.movimiento_id
        WHERE m.kcodcli2 = ${kcodcli2} AND m.tipomovi = 'V'
        ORDER BY m.fechanvt ASC, cmov.fecha ASC
      `,
    ]);

    // Merge rows into notas with pagos
    const notaMap = new Map<string, NotaConPagos>();
    const allRows = [
      ...vidaRows.map((r: any) => ({ ...r, _empresa: "vida" as const })),
      ...sanjhRows.map((r: any) => ({ ...r, _empresa: "sanjh" as const })),
    ];

    for (const r of allRows) {
      const empresa = r._empresa;
      const key = `${empresa}:${r.knumfoli}`;
      if (!notaMap.has(key)) {
        notaMap.set(key, {
          knumfoli: r.knumfoli,
          fechanvt: r.fechanvt,
          val_rea: parseFloat(r.val_rea),
          total_pagado: 0,
          saldo_pendiente: 0,
          empresa,
          pagos: [],
        });
      }
      const nota = notaMap.get(key)!;

      if (r.pago_id) {
        const pago: PagoDetalle = {
          movimiento_id: parseInt(r.pago_mov_id, 10),
          fecha: r.pago_fecha,
          monto_original: parseFloat(r.pago_monto_original),
          moneda_original: r.pago_moneda_original as "USD" | "CLP",
          tipo_cambio: r.pago_tipo_cambio ? parseFloat(r.pago_tipo_cambio) : null,
          monto_usd: parseFloat(r.pago_monto_usd),
          forma_pago: r.pago_forma_pago,
        };
        nota.pagos.push(pago);
        nota.total_pagado += pago.monto_usd;
      }
      nota.saldo_pendiente = nota.val_rea - nota.total_pagado;
    }

    // Get client name
    const vidaName = await sql`
      SELECT cliente FROM vida.movidcto WHERE kcodcli2 = ${kcodcli2} AND tipomovi = 'V' LIMIT 1
    `;
    const sanjhName = await sql`
      SELECT cliente FROM sanjh.movidcto WHERE kcodcli2 = ${kcodcli2} AND tipomovi = 'V' LIMIT 1
    `;
    const clientName = vidaName[0]?.cliente || sanjhName[0]?.cliente || "Desconocido";

    // Build result list
    let notas = Array.from(notaMap.values());

    // Filter by estado
    if (estado === "pendiente") {
      notas = notas.filter((n) => n.saldo_pendiente > 0.005);
    } else if (estado === "pagada") {
      notas = notas.filter((n) => n.saldo_pendiente <= 0.005);
    }

    // Order: pending first, then fechanvt ASC
    notas.sort((a, b) => {
      const aPending = a.saldo_pendiente > 0.005 ? 0 : 1;
      const bPending = b.saldo_pendiente > 0.005 ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return a.fechanvt.localeCompare(b.fechanvt);
    });

    if (notas.length === 0) {
      return NextResponse.json(
        { error: "Cliente no encontrado o sin notas de venta" },
        { status: 404 }
      );
    }

    const totalVendido = notas.reduce((s, n) => s + n.val_rea, 0);
    const totalPagado = notas.reduce((s, n) => s + n.total_pagado, 0);

    const result: ResumenClienteResponse = {
      cliente: { kcodcli2, nombre: clientName },
      notas,
      totales: {
        total_vendido: totalVendido,
        total_pagado: totalPagado,
        total_pendiente: totalVendido - totalPagado,
      },
    };

    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
