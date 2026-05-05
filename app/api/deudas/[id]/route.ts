import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { DeudaPatchSchema, buildConceptoDeuda } from "@/docs/specs/deudas.spec";

function authGuard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = authGuard(session);
  if (guard) return guard;

  const { id } = params;
  const isAdmin = (session!.user as any).rol === "admin";
  const userId = parseInt((session!.user as any).id, 10);

  try {
    const body = await request.json();
    const parsed = DeudaPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const rows = await sql`SELECT * FROM deudas_solicitudes WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const deuda = rows[0];
    const data = parsed.data;

    if (data.accion === "aceptar") {
      if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      if (deuda.estado !== "pendiente") return NextResponse.json({ error: "Estado inválido" }, { status: 409 });
      const [updated] = await sql`
        UPDATE deudas_solicitudes SET estado = 'aceptada', aceptado_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
      return NextResponse.json({ data: updated });
    }

    if (data.accion === "rechazar") {
      if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      if (deuda.estado !== "pendiente") return NextResponse.json({ error: "Estado inválido" }, { status: 409 });
      const [updated] = await sql`
        UPDATE deudas_solicitudes SET estado = 'rechazada', rechazado_motivo = ${data.motivo}
        WHERE id = ${id} RETURNING *
      `;
      return NextResponse.json({ data: updated });
    }

    if (data.accion === "confirmar") {
      if (deuda.user_id !== userId) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      if (deuda.estado !== "aceptada") return NextResponse.json({ error: "Estado inválido" }, { status: 409 });
      const concepto = buildConceptoDeuda(deuda.tipo, deuda.user_nombre, new Date());
      const creadoPor = (session!.user as any).nombre as string;
      const [updated] = await sql`
        UPDATE deudas_solicitudes SET estado = 'confirmada', confirmado_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
      await sql`
        INSERT INTO pettycash_movimientos (tipo, concepto, monto, creado_por)
        VALUES ('egreso', ${concepto}, ${deuda.monto}, ${creadoPor})
      `;
      return NextResponse.json({ data: updated });
    }

    if (data.accion === "pagar") {
      if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      const creadoPor = (session!.user as any).nombre as string;
      const [pago] = await sql`
        INSERT INTO deuda_pagos (deuda_id, monto, registrado_por)
        VALUES (${id}, ${data.monto}, ${creadoPor})
        RETURNING *
      `;
      return NextResponse.json({ data: pago });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
