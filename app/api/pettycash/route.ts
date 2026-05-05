import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { PettycashCreateSchema } from "@/docs/specs/pettycash.spec";

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
  const tipo = searchParams.get("tipo");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
  const offset = (page - 1) * limit;

  try {
    const [saldoRow] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo = 'egreso'  THEN monto ELSE 0 END), 0) AS saldo
      FROM pettycash_movimientos
    `;

    const rows = await sql`
      SELECT * FROM pettycash_movimientos
      WHERE
        (${tipo ?? null}::text IS NULL OR tipo = ${tipo ?? null})
        AND (${desde ?? null}::date IS NULL OR fecha >= ${desde ?? null}::date)
        AND (${hasta ?? null}::date IS NULL OR fecha <= ${hasta ?? null}::date)
      ORDER BY fecha DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [countRow] = await sql`
      SELECT COUNT(*)::int AS total FROM pettycash_movimientos
      WHERE
        (${tipo ?? null}::text IS NULL OR tipo = ${tipo ?? null})
        AND (${desde ?? null}::date IS NULL OR fecha >= ${desde ?? null}::date)
        AND (${hasta ?? null}::date IS NULL OR fecha <= ${hasta ?? null}::date)
    `;

    return NextResponse.json({
      data: rows,
      saldo: parseFloat(saldoRow.saldo),
      total: countRow.total,
    });
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
    const parsed = PettycashCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tipo, concepto, monto, fecha, empresa_id } = parsed.data;
    const creadoPor = (session!.user as any).nombre ?? (session!.user as any).id;

    const [row] = await sql`
      INSERT INTO pettycash_movimientos (tipo, concepto, monto, fecha, empresa_id, creado_por)
      VALUES (
        ${tipo},
        ${concepto},
        ${monto},
        ${fecha ?? null},
        ${empresa_id ?? null},
        ${creadoPor}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
