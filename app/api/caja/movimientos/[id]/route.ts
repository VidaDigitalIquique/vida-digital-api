import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  CajaMovimientoUpdateSchema,
  roundUpToHalf,
} from "@/docs/specs/caja-mayor.spec";

function guard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
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
    const parsed = CajaMovimientoUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Fetch current movement
    const rows = await sql`
      SELECT * FROM caja_movimientos WHERE id = ${movimientoId}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    const current = rows[0];
    const updates = parsed.data;

    // R22: if tipo changes to "gasto", delete all imputaciones
    const newTipo = updates.tipo ?? current.tipo;
    if (current.tipo === "cobro" && newTipo === "gasto") {
      await sql`DELETE FROM caja_movimiento_notas WHERE movimiento_id = ${movimientoId}`;
    }

    // R28: if kcodcli2 changes and there were imputaciones, delete them
    const newKcodcli2 = updates.kcodcli2 !== undefined ? updates.kcodcli2 : current.kcodcli2;
    if (current.kcodcli2 && newKcodcli2 !== parseInt(String(current.kcodcli2 || "0"), 10)) {
      await sql`DELETE FROM caja_movimiento_notas WHERE movimiento_id = ${movimientoId}`;
    }

    // Determine effective moneda and monto
    const newMoneda = updates.moneda ?? current.moneda;
    const newMonto = updates.monto ?? parseFloat(current.monto);
    const monedaChanged = updates.moneda !== undefined && updates.moneda !== current.moneda;
    const montoChanged = updates.monto !== undefined;

    let montoUsd: number;
    let tipoCambio: number | null;

    if (newMoneda === "USD") {
      // R23 / R26: USD → monto_usd = monto, tipo_cambio = null
      montoUsd = newMonto;
      tipoCambio = null;
    } else {
      // CLP — needs dolar_dia
      const dolarRows = await sql`
        SELECT valor FROM caja_config WHERE clave = 'dolar_dia'
      `;
      const dolarDia = parseFloat(dolarRows[0]?.valor || "0");
      if (dolarDia <= 0) {
        return NextResponse.json(
          { error: "Dólar del día no configurado. Contacta al administrador." },
          { status: 422 }
        );
      }

      if (monedaChanged || montoChanged) {
        // R24 / R25: recalculate with current dolar_dia from caja_config
        montoUsd = roundUpToHalf(newMonto / dolarDia);
        tipoCambio = dolarDia;
      } else {
        // Neither changed: preserve existing values
        montoUsd = parseFloat(current.monto_usd);
        tipoCambio = current.tipo_cambio ? parseFloat(current.tipo_cambio) : null;
      }
    }

    // R27: if monto_usd decreased, validate against existing imputaciones
    if (montoUsd < parseFloat(current.monto_usd || "0") - 0.005) {
      const imputado = await sql`
        SELECT COALESCE(SUM(monto_aplicado), 0) AS total
        FROM caja_movimiento_notas WHERE movimiento_id = ${movimientoId}
      `;
      const totalImputado = parseFloat(imputado[0].total);
      if (totalImputado > montoUsd + 0.005) {
        return NextResponse.json(
          {
            error: `El nuevo monto ($${montoUsd.toFixed(2)} USD) es menor que el total imputado ($${totalImputado.toFixed(2)} USD). Ajusta las imputaciones primero.`,
          },
          { status: 422 }
        );
      }
    }

    // R30: if tipo is "gasto" and empresa not provided, set to null
    const newEmpresa = updates.empresa !== undefined ? updates.empresa
      : (newTipo === "gasto" && updates.tipo === "gasto" ? null : current.empresa);

    const usuarioNombre = (session!.user as any).nombre as string;

    // Apply updates with COALESCE
    const updateFecha = updates.fecha ?? null;
    const updateTipo = updates.tipo ?? null;
    const updateCuentaId = updates.cuenta_id ?? null;
    const updateFormaPago = updates.forma_pago ?? null;
    const updateKcodcli2 = updates.kcodcli2 !== undefined ? updates.kcodcli2 : current.kcodcli2;
    const updateNombreCliente = updates.nombre_cliente !== undefined ? updates.nombre_cliente : current.nombre_cliente;
    const updateObservaciones = updates.observaciones !== undefined ? updates.observaciones : current.observaciones;

    const updated = await sql`
      UPDATE caja_movimientos
      SET fecha = COALESCE(${updateFecha}::date, fecha),
          tipo = COALESCE(${updateTipo}, tipo),
          kcodcli2 = ${updateKcodcli2},
          nombre_cliente = ${updateNombreCliente},
          cuenta_id = COALESCE(${updateCuentaId}, cuenta_id),
          moneda = ${newMoneda},
          monto = ${newMonto},
          monto_usd = ${montoUsd},
          tipo_cambio = ${tipoCambio},
          forma_pago = COALESCE(${updateFormaPago}, forma_pago),
          observaciones = ${updateObservaciones},
          empresa = ${newEmpresa},
          usuario_nombre = ${usuarioNombre},
          updated_at = now()
      WHERE id = ${movimientoId}
      RETURNING id, fecha::text, tipo, kcodcli2::bigint, nombre_cliente,
        cuenta_id, moneda, monto, monto_usd, tipo_cambio, forma_pago,
        observaciones, empresa, usuario_id, usuario_nombre,
        created_at::text, updated_at::text
    `;

    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
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
    const rows = await sql`
      DELETE FROM caja_movimientos WHERE id = ${movimientoId} RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: { id: rows[0].id, eliminado: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
