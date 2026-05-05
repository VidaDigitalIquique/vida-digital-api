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
      SELECT * FROM sueldos
      WHERE
        (${mes ?? null} IS NULL OR mes = ${mes ? parseInt(mes) : 0})
        AND (${anio ?? null} IS NULL OR anio = ${anio ? parseInt(anio) : 0})
      ORDER BY anio DESC, mes DESC, created_at DESC
    `;
    return NextResponse.json({ data: rows });
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

    const { trabajador_nombre, mes, anio, monto_base, monto_final } = parsed.data;
    const creadoPor = (session!.user as any).nombre ?? (session!.user as any).id;
    const concepto = buildConceptoPettycash(trabajador_nombre, mes, anio);

    const [sueldo] = await sql`
      INSERT INTO sueldos (trabajador_nombre, mes, anio, monto_base, monto_final, creado_por)
      VALUES (${trabajador_nombre}, ${mes}, ${anio}, ${monto_base}, ${monto_final}, ${creadoPor})
      RETURNING *
    `;

    await sql`
      INSERT INTO pettycash_movimientos (tipo, concepto, monto, creado_por)
      VALUES ('egreso', ${concepto}, ${monto_final}, ${creadoPor})
    `;

    return NextResponse.json({ data: sueldo }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
