import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { CajaImputacionCreateSchema } from "@/docs/specs/caja-mayor.spec";

function guard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  const movimientoId = parseInt(params.id, 10);
  if (isNaN(movimientoId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = CajaImputacionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { notas } = parsed.data;

    // Fetch movement
    const movRows = await sql`
      SELECT id, tipo, kcodcli2, moneda, monto, monto_usd, empresa
      FROM caja_movimientos
      WHERE id = ${movimientoId}
    `;
    if (movRows.length === 0) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    const mov = movRows[0];

    // R11: must be a cobro
    if (mov.tipo !== "cobro") {
      return NextResponse.json(
        { error: "Solo se pueden imputar notas a cobros" },
        { status: 422 }
      );
    }

    // R12: must have a client
    if (!mov.kcodcli2) {
      return NextResponse.json(
        { error: "El movimiento no tiene cliente asignado" },
        { status: 422 }
      );
    }

    const kcodcli2 = parseInt(mov.kcodcli2, 10);
    const montoDisponibleUsd = parseFloat(mov.monto_usd ?? mov.monto);

    // Validate each nota and calculate totals
    let totalImputado = 0;
    const notasValidadas: { empresa: string; knumfoli: string; monto_aplicado: number; val_rea: number; total_previo: number }[] = [];

    for (const n of notas) {
      // R14: nota must exist for this client in the specified empresa
      const notaRows = n.empresa === "vida"
        ? await sql`SELECT knumfoli, val_rea FROM vida.movidcto WHERE knumfoli = ${n.knumfoli} AND kcodcli2 = ${kcodcli2} AND tipomovi = 'V' LIMIT 1`
        : await sql`SELECT knumfoli, val_rea FROM sanjh.movidcto WHERE knumfoli = ${n.knumfoli} AND kcodcli2 = ${kcodcli2} AND tipomovi = 'V' LIMIT 1`;

      if (notaRows.length === 0) {
        return NextResponse.json(
          { error: `Nota ${n.knumfoli} no encontrada para el cliente en ${n.empresa}` },
          { status: 422 }
        );
      }

      const valRea = parseFloat(notaRows[0].val_rea);

      // R15: monto_aplicado <= saldo pendiente (across ALL movements, excluding this one)
      const pagadoRows = await sql`
        SELECT COALESCE(SUM(cmn.monto_aplicado), 0) AS total
        FROM caja_movimiento_notas cmn
        WHERE cmn.empresa = ${n.empresa} AND cmn.knumfoli = ${n.knumfoli}
          AND cmn.movimiento_id != ${movimientoId}
      `;
      const totalPrevio = parseFloat(pagadoRows[0].total);
      const saldoDisponible = valRea - totalPrevio;

      if (n.monto_aplicado > saldoDisponible + 0.005) {
        return NextResponse.json(
          { error: `Nota ${n.knumfoli}: monto $${n.monto_aplicado.toFixed(2)} excede saldo pendiente $${saldoDisponible.toFixed(2)}` },
          { status: 422 }
        );
      }

      totalImputado += n.monto_aplicado;
      notasValidadas.push({
        empresa: n.empresa,
        knumfoli: n.knumfoli,
        monto_aplicado: n.monto_aplicado,
        val_rea: valRea,
        total_previo: totalPrevio,
      });
    }

    // R13: total imputado <= monto disponible
    if (totalImputado > montoDisponibleUsd + 0.005) {
      return NextResponse.json(
        { error: `El total imputado ($${totalImputado.toFixed(2)}) excede el monto del cobro ($${montoDisponibleUsd.toFixed(2)} USD)` },
        { status: 422 }
      );
    }

    // Replace: delete existing imputaciones for this movement, then insert new
    await sql`DELETE FROM caja_movimiento_notas WHERE movimiento_id = ${movimientoId}`;

    const inserted: any[] = [];
    for (const n of notasValidadas) {
      const rows = await sql`
        INSERT INTO caja_movimiento_notas (movimiento_id, empresa, knumfoli, monto_aplicado)
        VALUES (${movimientoId}, ${n.empresa}, ${n.knumfoli}, ${n.monto_aplicado})
        RETURNING id, empresa, knumfoli, monto_aplicado
      `;
      inserted.push(rows[0]);
    }

    return NextResponse.json(
      {
        data: {
          movimiento_id: movimientoId,
          total_imputado: totalImputado,
          monto_disponible: montoDisponibleUsd - totalImputado,
          notas: inserted,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
