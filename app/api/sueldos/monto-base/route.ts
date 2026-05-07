import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

function adminOnly(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).rol !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = adminOnly(session);
  if (guard) return guard;

  try {
    const { usuario_id, monto_base } = await request.json();
    if (!usuario_id || typeof monto_base !== "number") {
      return NextResponse.json({ error: "usuario_id y monto_base requeridos" }, { status: 400 });
    }

    const creadoPor = (session!.user as any).nombre ?? (session!.user as any).id;
    const [usuario] = await sql`SELECT nombre FROM usuarios WHERE id = ${usuario_id}`;
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 400 });
    }

    await sql`
      INSERT INTO sueldos (usuario_id, trabajador_nombre, mes, anio, monto_base, monto_final, creado_por)
      VALUES (${usuario_id}, ${usuario.nombre}, 0, 0, ${monto_base}, 0, ${creadoPor})
    `;

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
