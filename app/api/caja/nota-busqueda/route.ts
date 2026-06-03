import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NotaBusquedaResult } from "@/docs/specs/caja-mayor.spec";

function guard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (q.length < 3) {
    return NextResponse.json({ error: "Mínimo 3 caracteres para buscar" }, { status: 400 });
  }

  try {
    // Zero-pad to 6 digits if input looks like a number
    const isNumeric = /^\d+$/.test(q);
    const padded6 = isNumeric ? q.padStart(6, "0") : q;
    const pattern = `%${q}%`;

    const vidaRows = await sql`
      SELECT
        m.knumfoli,
        m.fechanvt::text,
        m.val_rea,
        m.kcodcli2,
        m.cliente AS nombre_cliente,
        COALESCE((
          SELECT SUM(cmn.monto_aplicado)
          FROM caja_movimiento_notas cmn
          WHERE cmn.empresa = 'vida' AND cmn.knumfoli = m.knumfoli::text
        ), 0) AS total_pagado,
        'vida' AS empresa
      FROM vida.movidcto m
      WHERE m.tipomovi = 'V'
        AND (
          m.knumfoli = ${padded6}
          OR m.knumfoli = ${q}
          OR m.knumfoli ILIKE ${pattern}
        )
      LIMIT 10
    `;

    const sanjhRows = await sql`
      SELECT
        m.knumfoli,
        m.fechanvt::text,
        m.val_rea,
        m.kcodcli2,
        m.cliente AS nombre_cliente,
        COALESCE((
          SELECT SUM(cmn.monto_aplicado)
          FROM caja_movimiento_notas cmn
          WHERE cmn.empresa = 'sanjh' AND cmn.knumfoli = m.knumfoli::text
        ), 0) AS total_pagado,
        'sanjh' AS empresa
      FROM sanjh.movidcto m
      WHERE m.tipomovi = 'V'
        AND (
          m.knumfoli = ${padded6}
          OR m.knumfoli = ${q}
          OR m.knumfoli ILIKE ${pattern}
        )
      LIMIT 10
    `;

    const results: NotaBusquedaResult[] = [...vidaRows, ...sanjhRows].map((r: any) => ({
      knumfoli: r.knumfoli,
      fechanvt: r.fechanvt,
      val_rea: parseFloat(r.val_rea),
      total_pagado: parseFloat(r.total_pagado),
      saldo_pendiente: parseFloat(r.val_rea) - parseFloat(r.total_pagado),
      kcodcli2: parseInt(r.kcodcli2, 10),
      nombre_cliente: r.nombre_cliente,
      empresa: r.empresa as "vida" | "sanjh",
    }));

    // Sort: pending first, then by date ASC (oldest first)
    results.sort((a, b) => {
      const aPending = a.saldo_pendiente > 0.005 ? 0 : 1;
      const bPending = b.saldo_pendiente > 0.005 ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return a.fechanvt.localeCompare(b.fechanvt);
    });

    return NextResponse.json({ data: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
