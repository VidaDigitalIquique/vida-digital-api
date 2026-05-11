import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = params;
  const userId = parseInt((session.user as any).id, 10);
  const isAdmin = (session.user as any).rol === "admin";

  try {
    let body: any = {};
    try { body = await request.json(); } catch {}

    if (body.accion === "confirmar") {
      const existing = await sql`SELECT id, usuario_id, pagado_at, confirmado_at FROM sueldos WHERE id = ${id}`;
      if (existing.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      const s = existing[0];
      if (s.usuario_id !== userId) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      if (!s.pagado_at) return NextResponse.json({ error: "El sueldo aún no ha sido pagado" }, { status: 409 });
      if (s.confirmado_at) return NextResponse.json({ error: "Ya confirmado" }, { status: 409 });
      const [updated] = await sql`
        UPDATE sueldos SET confirmado_at = NOW() WHERE id = ${id} RETURNING *
      `;
      return NextResponse.json({ data: updated });
    }

    if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    const existing = await sql`SELECT id, pagado_at FROM sueldos WHERE id = ${id}`;
    if (existing.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (existing[0].pagado_at) return NextResponse.json({ error: "Ya marcado como pagado" }, { status: 409 });
    const [updated] = await sql`
      UPDATE sueldos SET pagado_at = NOW() WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
