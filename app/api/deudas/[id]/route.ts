import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { DeudaPatchSchema } from "@/docs/specs/deudas.spec";

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

  try {
    const body = await request.json();
    const parsed = DeudaPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

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

    if (data.accion === "editar") {
      if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      const [updated] = await sql`
        UPDATE deudas_solicitudes
        SET monto = COALESCE(${data.monto ?? null}, monto),
            descripcion = COALESCE(${data.descripcion ?? null}, descripcion)
        WHERE id = ${id} RETURNING *
      `;
      if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      return NextResponse.json({ data: updated });
    }

    if (data.accion === "editar_pago") {
      if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      const [pago] = await sql`
        UPDATE deuda_pagos SET monto = ${data.monto}
        WHERE id = ${data.pago_id} AND deuda_id = ${id}
        RETURNING *
      `;
      if (!pago) return NextResponse.json({ error: "Pago no encontrado o no pertenece a esta deuda" }, { status: 404 });
      return NextResponse.json({ data: pago });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = params;
  await sql`DELETE FROM deuda_pagos WHERE deuda_id = ${id}`;
  const result = await sql`DELETE FROM deudas_solicitudes WHERE id = ${id} RETURNING id`;
  if (result.length === 0)
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
