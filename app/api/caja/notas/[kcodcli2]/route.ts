import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NotaVentaConSaldo } from "@/docs/specs/caja-mayor.spec";

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
    // Fetch notas from both empresas
    const vidaRows = await sql`
      SELECT
        m.knumfoli,
        m.fechanvt::text,
        m.val_rea,
        COALESCE((
          SELECT SUM(cmn.monto_aplicado)
          FROM caja_movimiento_notas cmn
          WHERE cmn.empresa = 'vida' AND cmn.knumfoli = m.knumfoli::text
        ), 0) AS total_pagado,
        'vida' AS empresa
      FROM vida.movidcto m
      WHERE m.kcodcli2 = ${kcodcli2}
        AND m.tipomovi = 'V'
    `;

    const sanjhRows = await sql`
      SELECT
        m.knumfoli,
        m.fechanvt::text,
        m.val_rea,
        COALESCE((
          SELECT SUM(cmn.monto_aplicado)
          FROM caja_movimiento_notas cmn
          WHERE cmn.empresa = 'sanjh' AND cmn.knumfoli = m.knumfoli::text
        ), 0) AS total_pagado,
        'sanjh' AS empresa
      FROM sanjh.movidcto m
      WHERE m.kcodcli2 = ${kcodcli2}
        AND m.tipomovi = 'V'
    `;

    // Merge and build result
    const todas: NotaVentaConSaldo[] = [];

    for (const r of vidaRows) {
      todas.push({
        knumfoli: r.knumfoli,
        fechanvt: r.fechanvt,
        val_rea: parseFloat(r.val_rea),
        total_pagado: parseFloat(r.total_pagado),
        saldo_pendiente: parseFloat(r.val_rea) - parseFloat(r.total_pagado),
        empresa: "vida",
      });
    }

    for (const r of sanjhRows) {
      todas.push({
        knumfoli: r.knumfoli,
        fechanvt: r.fechanvt,
        val_rea: parseFloat(r.val_rea),
        total_pagado: parseFloat(r.total_pagado),
        saldo_pendiente: parseFloat(r.val_rea) - parseFloat(r.total_pagado),
        empresa: "sanjh",
      });
    }

    // Order: pending first (saldo > 0), then by fechanvt ASC (oldest first)
    todas.sort((a, b) => {
      const aPending = a.saldo_pendiente > 0.005 ? 0 : 1;
      const bPending = b.saldo_pendiente > 0.005 ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return a.fechanvt.localeCompare(b.fechanvt);
    });

    if (todas.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado o sin notas de venta" }, { status: 404 });
    }

    return NextResponse.json({ data: todas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
