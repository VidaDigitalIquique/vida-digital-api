import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).rol !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const usuario_id = searchParams.get("usuario_id");
  if (!usuario_id) return NextResponse.json({ error: "usuario_id requerido" }, { status: 400 });

  const now = new Date();
  const mes  = parseInt(searchParams.get("mes")  ?? String(now.getMonth() + 1));
  const anio = parseInt(searchParams.get("anio") ?? String(now.getFullYear()));

  try {
    const movimientos = await sql`
      SELECT id, tipo, monto, descripcion, mes, anio, solicitado_at, confirmado_at
      FROM deudas_solicitudes
      WHERE user_id = ${parseInt(usuario_id)}
        AND tipo    IN ('adelanto', 'quincena')
        AND estado  = 'confirmada'
        AND mes     = ${mes}
        AND anio    = ${anio}
      ORDER BY solicitado_at ASC
    `;

    const total_descuentos = movimientos.reduce(
      (sum, m) => sum + parseFloat(String(m.monto)),
      0
    );

    const sueldoRows = await sql`
      SELECT id, monto_base, monto_final, pagado_at, created_at
      FROM sueldos
      WHERE usuario_id = ${parseInt(usuario_id)} AND mes = ${mes} AND anio = ${anio}
      LIMIT 1
    `;
    const sueldo = sueldoRows[0] ?? null;

    return NextResponse.json({ movimientos, total_descuentos, sueldo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
