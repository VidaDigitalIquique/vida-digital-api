import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { SueldoCreateSchema, buildConceptoPettycash } from "@/docs/specs/sueldos.spec";

function adminOnly(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).rol !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = adminOnly(session);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes");
  const anio = searchParams.get("anio");
  try {
    const rows = await sql`
      SELECT s.id, s.usuario_id, s.trabajador_nombre, s.mes, s.anio,
             s.monto_base, s.monto_final, s.pagado_at, s.creado_por, s.created_at,
             u.rut AS trabajador_rut
      FROM sueldos s
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      WHERE
        (${mes ?? null} IS NULL OR s.mes = ${mes ? parseInt(mes) : 0})
        AND (${anio ?? null} IS NULL OR s.anio = ${anio ? parseInt(anio) : 0})
      ORDER BY s.anio DESC, s.mes DESC, s.created_at DESC
    `;
    return NextResponse.json({ sueldos: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = adminOnly(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = SueldoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { usuario_id, mes, anio, monto_base, monto_final } = parsed.data;
    const creadoPor = (session!.user as any).nombre ?? (session!.user as any).id;

    const usuarioRows = await sql`SELECT nombre FROM usuarios WHERE id = ${usuario_id}`;
    if (usuarioRows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 400 });
    }
    const trabajador_nombre = usuarioRows[0].nombre as string;
    const existing = await sql`
      SELECT id FROM sueldos WHERE usuario_id = ${usuario_id} AND mes = ${mes} AND anio = ${anio}
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: { message: `Ya existe un sueldo registrado para ${trabajador_nombre} en ${mes}/${anio}` } },
        { status: 409 }
      );
    }

    const [sueldo] = await sql`
      INSERT INTO sueldos (usuario_id, trabajador_nombre, mes, anio, monto_base, monto_final, creado_por)
      VALUES (${usuario_id}, ${trabajador_nombre}, ${mes}, ${anio}, ${monto_base}, ${monto_final}, ${creadoPor})
      RETURNING *
    `;

    return NextResponse.json({ data: sueldo }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
