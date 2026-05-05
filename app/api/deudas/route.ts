import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { DeudaCreateSchema } from "@/docs/specs/deudas.spec";

function authGuard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = authGuard(session);
  if (guard) return guard;

  const userId = parseInt((session!.user as any).id, 10);
  const isAdmin = (session!.user as any).rol === "admin";
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");

  try {
    if (isAdmin) {
      await sql`
        UPDATE deudas_solicitudes
        SET estado = 'caduca'
        WHERE estado = 'aceptada' AND caduca_at < NOW()
      `;
      const rows = await sql`
        SELECT * FROM deudas_solicitudes
        WHERE (${estado ?? null} IS NULL OR estado = ${estado ?? ""})
        ORDER BY solicitado_at DESC
      `;
      return NextResponse.json({ deudas: rows });
    }

    const rows = await sql`
      SELECT * FROM deudas_solicitudes
      WHERE user_id = ${userId}
        AND (${estado ?? null} IS NULL OR estado = ${estado ?? ""})
      ORDER BY solicitado_at DESC
    `;
    return NextResponse.json({ deudas: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = authGuard(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = DeudaCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tipo, monto, descripcion } = parsed.data;
    const userId = parseInt((session!.user as any).id, 10);
    const userNombre = (session!.user as any).nombre as string;

    const [deuda] = await sql`
      INSERT INTO deudas_solicitudes (user_id, user_nombre, tipo, monto, descripcion, creado_por)
      VALUES (${userId}, ${userNombre}, ${tipo}, ${monto}, ${descripcion ?? null}, ${userNombre})
      RETURNING *
    `;

    return NextResponse.json({ data: deuda }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
