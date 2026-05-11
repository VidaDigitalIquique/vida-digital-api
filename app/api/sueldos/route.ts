import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { SueldoCreateSchema } from "@/docs/specs/sueldos.spec";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const isAdmin = (session.user as any).rol === "admin";
  const userId = parseInt((session.user as any).id, 10);

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes");
  const anio = searchParams.get("anio");
  try {
    const rows = isAdmin
      ? await sql`
          SELECT s.id, s.usuario_id, s.trabajador_nombre, s.mes, s.anio,
                 s.tipo, s.monto_base, s.monto_final, s.descripcion,
                 s.pagado_at, s.confirmado_at, s.creado_por, s.created_at,
                 u.rut AS trabajador_rut
          FROM sueldos s
          LEFT JOIN usuarios u ON u.id = s.usuario_id
          WHERE
            (${mes ?? null} IS NULL OR s.mes = ${mes ? parseInt(mes) : 0})
            AND (${anio ?? null} IS NULL OR s.anio = ${anio ? parseInt(anio) : 0})
          ORDER BY s.anio DESC, s.mes DESC, s.created_at DESC
        `
      : await sql`
          SELECT s.id, s.usuario_id, s.trabajador_nombre, s.mes, s.anio,
                 s.tipo, s.monto_base, s.monto_final, s.descripcion,
                 s.pagado_at, s.confirmado_at, s.creado_por, s.created_at
          FROM sueldos s
          WHERE s.usuario_id = ${userId}
          ORDER BY s.anio DESC, s.mes DESC, s.created_at DESC
        `;
    return NextResponse.json({ sueldos: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin")
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  try {
    const body = await request.json();
    const parsed = SueldoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { usuario_id, mes, anio, tipo, monto, monto_base, monto_final, descripcion } = parsed.data;
    const creadoPor = (session!.user as any).nombre ?? (session!.user as any).id;

    const usuarioRows = await sql`SELECT nombre FROM usuarios WHERE id = ${usuario_id}`;
    if (usuarioRows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 400 });
    }
    const trabajador_nombre = usuarioRows[0].nombre as string;

    const base = tipo === "sueldo" ? monto_base! : monto!;
    const final = tipo === "sueldo" ? monto_final! : monto!;

    if (tipo === "sueldo") {
      if (!monto_base || !monto_final) {
        return NextResponse.json(
          { error: { message: "monto_base y monto_final son requeridos para sueldo" } },
          { status: 400 }
        );
      }
      const existing = await sql`
        SELECT id FROM sueldos WHERE usuario_id = ${usuario_id} AND mes = ${mes} AND anio = ${anio} AND tipo = 'sueldo'
      `;
      if (existing.length > 0) {
        return NextResponse.json(
          { error: { message: `Ya existe un sueldo registrado para ${trabajador_nombre} en ${mes}/${anio}` } },
          { status: 409 }
        );
      }
    } else {
      if (!monto) {
        return NextResponse.json(
          { error: { message: "monto es requerido para adelanto/quincena" } },
          { status: 400 }
        );
      }
    }

    const [sueldo] = await sql`
      INSERT INTO sueldos (usuario_id, trabajador_nombre, mes, anio, tipo, monto_base, monto_final, descripcion, creado_por)
      VALUES (${usuario_id}, ${trabajador_nombre}, ${mes}, ${anio}, ${tipo}, ${base}, ${final}, ${descripcion ?? null}, ${creadoPor})
      RETURNING *
    `;

    return NextResponse.json({ data: sueldo }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
