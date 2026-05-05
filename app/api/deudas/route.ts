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
  const usuarioId = searchParams.get("usuario_id") ? parseInt(searchParams.get("usuario_id")!) : null;

  try {
    if (isAdmin) {
      await sql`
        UPDATE deudas_solicitudes
        SET estado = 'caduca'
        WHERE estado = 'aceptada' AND caduca_at < NOW()
      `;
      const rows = usuarioId
        ? await sql`SELECT * FROM deudas_solicitudes WHERE user_id = ${usuarioId} ORDER BY solicitado_at DESC`
        : estado
          ? await sql`SELECT * FROM deudas_solicitudes WHERE estado = ${estado} ORDER BY solicitado_at DESC`
          : await sql`SELECT * FROM deudas_solicitudes ORDER BY solicitado_at DESC`;
      return NextResponse.json({ deudas: rows });
    }

    const rows = estado
      ? await sql`SELECT * FROM deudas_solicitudes WHERE user_id = ${userId} AND estado = ${estado} ORDER BY solicitado_at DESC`
      : await sql`SELECT * FROM deudas_solicitudes WHERE user_id = ${userId} ORDER BY solicitado_at DESC`;
    return NextResponse.json({ deudas: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = authGuard(session);
  if (guard) return guard;

  if ((session!.user as any).rol !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = DeudaCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { usuario_id, tipo, monto, descripcion, mes, anio } = parsed.data;
    const creadoPor = (session!.user as any).nombre as string;
    const now = new Date();
    const mesEfectivo = mes ?? (now.getMonth() + 1);
    const anioEfectivo = anio ?? now.getFullYear();

    const usuarioRows = await sql`SELECT nombre FROM usuarios WHERE id = ${usuario_id}`;
    if (usuarioRows.length === 0) {
      return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 400 });
    }
    const userNombre = usuarioRows[0].nombre as string;

    // préstamos: aceptada (worker confirma recepción); adelanto/quincena: confirmada directamente
    const estado = tipo === "prestamo" ? "aceptada" : "confirmada";
    const caduca_at = tipo === "prestamo"
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const [deuda] = await sql`
      INSERT INTO deudas_solicitudes
        (user_id, user_nombre, tipo, monto, descripcion, mes, anio, estado, creado_por, caduca_at)
      VALUES
        (${usuario_id}, ${userNombre}, ${tipo}, ${monto}, ${descripcion ?? null},
         ${mesEfectivo}, ${anioEfectivo}, ${estado}, ${creadoPor}, ${caduca_at})
      RETURNING *
    `;

    return NextResponse.json({ data: deuda }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
