import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

function adminOnly(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).rol !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = adminOnly(session);
  if (guard) return guard;

  const uid = parseInt(params.id);
  const [row] = await sql`
    SELECT monto_base FROM trabajador_config WHERE usuario_id = ${uid}
  `;
  return NextResponse.json({ monto_base: row ? Number(row.monto_base) : 0 });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = adminOnly(session);
  if (guard) return guard;

  const uid = parseInt(params.id);
  const { monto_base } = await request.json();

  await sql`
    INSERT INTO trabajador_config (usuario_id, monto_base, updated_at)
    VALUES (${uid}, ${Math.round(monto_base)}, NOW())
    ON CONFLICT (usuario_id)
    DO UPDATE SET monto_base = EXCLUDED.monto_base, updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}
