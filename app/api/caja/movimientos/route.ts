import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  CajaMovimientoCreateSchema,
  roundUpToHalf,
} from "@/docs/specs/caja-mayor.spec";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;

    // Filters — null means "no filter"
    const cuentaId = searchParams.get("cuenta_id") ? parseInt(searchParams.get("cuenta_id")!, 10) : null;
    const monedaFiltro = searchParams.get("moneda") || null;
    const tipoFiltro = searchParams.get("tipo") || null;
    const empresaFiltro = searchParams.get("empresa") || null;
    const desde = searchParams.get("desde") || null;
    const hasta = searchParams.get("hasta") || null;

    // Safe parameterized query: COALESCE/IS NULL pattern — no string interpolation
    const rows = await sql`
      SELECT m.id, m.fecha::text, m.tipo, m.kcodcli2::bigint, m.nombre_cliente,
        m.cuenta_id, cc.nombre AS cuenta_nombre, m.moneda, m.monto, m.monto_usd,
        m.tipo_cambio, m.forma_pago, m.observaciones, m.empresa,
        m.usuario_id, m.usuario_nombre, m.created_at::text, m.updated_at::text
      FROM caja_movimientos m
      JOIN caja_cuentas cc ON cc.id = m.cuenta_id
      WHERE (${cuentaId}::int IS NULL OR m.cuenta_id = ${cuentaId})
        AND (${monedaFiltro}::text IS NULL OR m.moneda = ${monedaFiltro})
        AND (${tipoFiltro}::text IS NULL OR m.tipo = ${tipoFiltro})
        AND (${empresaFiltro}::text IS NULL OR m.empresa = ${empresaFiltro})
        AND (${desde}::date IS NULL OR m.fecha >= ${desde}::date)
        AND (${hasta}::date IS NULL OR m.fecha <= ${hasta}::date)
      ORDER BY m.fecha DESC, m.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Count total (same filters)
    const countRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM caja_movimientos m
      WHERE (${cuentaId}::int IS NULL OR m.cuenta_id = ${cuentaId})
        AND (${monedaFiltro}::text IS NULL OR m.moneda = ${monedaFiltro})
        AND (${tipoFiltro}::text IS NULL OR m.tipo = ${tipoFiltro})
        AND (${empresaFiltro}::text IS NULL OR m.empresa = ${empresaFiltro})
        AND (${desde}::date IS NULL OR m.fecha >= ${desde}::date)
        AND (${hasta}::date IS NULL OR m.fecha <= ${hasta}::date)
    `;

    const total = countRows[0].total as number;

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function guard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  try {
    const body = await request.json();
    const parsed = CajaMovimientoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { fecha, tipo, kcodcli2, nombre_cliente, cuenta_id, moneda, monto, forma_pago, observaciones, empresa } = parsed.data;

    // R5: cobro requires client
    if (tipo === "cobro" && (!kcodcli2 || !nombre_cliente)) {
      return NextResponse.json(
        { error: "Cliente requerido para cobros" },
        { status: 400 }
      );
    }

    // R6: gasto → empresa can be null
    const finalEmpresa = tipo === "gasto" ? (empresa ?? null) : empresa;

    // R10: validate empresa if client selected
    if (kcodcli2 && finalEmpresa) {
      const checkResult = finalEmpresa === "vida"
        ? await sql`SELECT 1 FROM vida.movidcto WHERE kcodcli2 = ${kcodcli2} AND tipomovi = 'V' LIMIT 1`
        : await sql`SELECT 1 FROM sanjh.movidcto WHERE kcodcli2 = ${kcodcli2} AND tipomovi = 'V' LIMIT 1`;
      if (checkResult.length === 0) {
        return NextResponse.json(
          { error: "El cliente no tiene compras en la empresa seleccionada" },
          { status: 422 }
        );
      }
    }

    // R7 / R8: CLP → USD conversion
    let monto_usd: number | null = null;
    let tipo_cambio: number | null = null;

    if (moneda === "CLP") {
      const configRows = await sql`
        SELECT valor FROM caja_config WHERE clave = 'dolar_dia'
      `;
      const dolarDia = parseFloat(configRows[0]?.valor || "0");
      if (dolarDia <= 0) {
        return NextResponse.json(
          { error: "Dólar del día no configurado. Contacta al administrador." },
          { status: 422 }
        );
      }
      tipo_cambio = dolarDia;
      monto_usd = roundUpToHalf(monto / dolarDia);
    } else {
      monto_usd = monto;
      tipo_cambio = null;
    }

    const usuarioId = parseInt((session!.user as any).id, 10);
    const usuarioNombre = (session!.user as any).nombre as string;

    const rows = await sql`
      INSERT INTO caja_movimientos (
        fecha, tipo, kcodcli2, nombre_cliente, cuenta_id, moneda,
        monto, monto_usd, tipo_cambio, forma_pago, observaciones,
        empresa, usuario_id, usuario_nombre
      ) VALUES (
        ${fecha}::date, ${tipo},
        ${kcodcli2 ?? null}, ${nombre_cliente ?? null},
        ${cuenta_id}, ${moneda},
        ${monto}, ${monto_usd}, ${tipo_cambio},
        ${forma_pago}, ${observaciones ?? null},
        ${finalEmpresa ?? null}, ${usuarioId}, ${usuarioNombre}
      )
      RETURNING id, fecha::text, tipo, kcodcli2::bigint, nombre_cliente,
        cuenta_id, moneda, monto, monto_usd, tipo_cambio, forma_pago,
        observaciones, empresa, usuario_id, usuario_nombre,
        created_at::text, updated_at::text
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
