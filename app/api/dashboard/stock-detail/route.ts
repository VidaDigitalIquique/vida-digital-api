import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('empresaId');
  const tipo = searchParams.get('tipo');

  if (!empresaId || !tipo) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const eid = parseInt(empresaId, 10);
  if (Number.isNaN(eid)) {
    return NextResponse.json({ error: "empresaId inválido" }, { status: 400 });
  }

  if (!(session.user as any).empresas.includes(eid)) {
    return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
  }

  if (tipo !== 'sobrante' && tipo !== 'faltante') {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  try {
    const rows = tipo === 'sobrante'
      ? await sql`
        WITH producto_saldos AS (
          SELECT
            u.codigo as codigo,
            MAX(p.detalle) as detalle,
            SUM(p.saldo)::int as saldo,
            CASE
              WHEN BOOL_AND(u.fisico IS NULL) THEN NULL
              ELSE SUM(COALESCE(u.fisico, 0))::int
            END as fisico
          FROM productos p
          JOIN ubicaciones_bodega u
            ON u.empresa_id = p.empresa_id AND u.codigo = p.codigo
          WHERE p.empresa_id = ${eid}
          GROUP BY u.codigo
        )
        SELECT
          codigo,
          detalle,
          saldo,
          fisico,
          (fisico - saldo)::int as diferencia
        FROM producto_saldos
        WHERE fisico IS NOT NULL AND fisico > saldo
        ORDER BY diferencia DESC, codigo ASC
      `
      : await sql`
        WITH producto_saldos AS (
          SELECT
            u.codigo as codigo,
            MAX(p.detalle) as detalle,
            SUM(p.saldo)::int as saldo,
            CASE
              WHEN BOOL_AND(u.fisico IS NULL) THEN NULL
              ELSE SUM(COALESCE(u.fisico, 0))::int
            END as fisico
          FROM productos p
          JOIN ubicaciones_bodega u
            ON u.empresa_id = p.empresa_id AND u.codigo = p.codigo
          WHERE p.empresa_id = ${eid}
          GROUP BY u.codigo
        )
        SELECT
          codigo,
          detalle,
          saldo,
          fisico,
          (fisico - saldo)::int as diferencia
        FROM producto_saldos
        WHERE fisico IS NOT NULL AND fisico < saldo
        ORDER BY diferencia ASC, codigo ASC
      `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/dashboard/stock-detail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
