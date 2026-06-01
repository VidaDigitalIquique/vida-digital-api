import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

function guard(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ error: "Mínimo 2 caracteres para buscar" }, { status: 400 });
  }

  try {
    const pattern = `%${q}%`;

    const vidaRows = await sql`
      SELECT DISTINCT ON (m.kcodcli2)
        m.kcodcli2::bigint,
        m.cliente AS nombre,
        COUNT(*) OVER (PARTITION BY m.kcodcli2)::int AS total_compras,
        MAX(m.fechanvt) OVER (PARTITION BY m.kcodcli2)::text AS ultima_compra
      FROM vida.movidcto m
      WHERE m.tipomovi = 'V'
        AND m.kcodcli2 IS NOT NULL
        AND m.cliente ILIKE ${pattern}
      ORDER BY m.kcodcli2, m.fechanvt DESC
      LIMIT 15
    `;

    const sanjhRows = await sql`
      SELECT DISTINCT ON (m.kcodcli2)
        m.kcodcli2::bigint,
        m.cliente AS nombre,
        COUNT(*) OVER (PARTITION BY m.kcodcli2)::int AS total_compras,
        MAX(m.fechanvt) OVER (PARTITION BY m.kcodcli2)::text AS ultima_compra
      FROM sanjh.movidcto m
      WHERE m.tipomovi = 'V'
        AND m.kcodcli2 IS NOT NULL
        AND m.cliente ILIKE ${pattern}
      ORDER BY m.kcodcli2, m.fechanvt DESC
      LIMIT 15
    `;

    // Merge by kcodcli2: combine empresas, sum purchases, keep latest date
    const map = new Map<number, { nombre: string; empresas: Set<string>; total_compras: number; ultima_compra: string }>();

    for (const r of vidaRows) {
      map.set(r.kcodcli2, {
        nombre: r.nombre,
        empresas: new Set(["vida"]),
        total_compras: r.total_compras,
        ultima_compra: r.ultima_compra,
      });
    }

    for (const r of sanjhRows) {
      const existing = map.get(r.kcodcli2);
      if (existing) {
        existing.empresas.add("sanjh");
        existing.total_compras += r.total_compras;
        if (r.ultima_compra > existing.ultima_compra) {
          existing.nombre = r.nombre;
          existing.ultima_compra = r.ultima_compra;
        }
      } else {
        map.set(r.kcodcli2, {
          nombre: r.nombre,
          empresas: new Set(["sanjh"]),
          total_compras: r.total_compras,
          ultima_compra: r.ultima_compra,
        });
      }
    }

    const result = Array.from(map.entries())
      .map(([kcodcli2, v]) => ({
        kcodcli2,
        nombre: v.nombre,
        empresas: Array.from(v.empresas).sort(),
        total_compras: v.total_compras,
        ultima_compra: v.ultima_compra,
      }))
      .sort((a, b) => b.ultima_compra.localeCompare(a.ultima_compra))
      .slice(0, 15);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
