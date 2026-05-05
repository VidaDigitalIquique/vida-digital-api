import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

function adminOnly(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).rol !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  return null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = adminOnly(session);
  if (guard) return guard;

  const { id } = params;

  try {
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
