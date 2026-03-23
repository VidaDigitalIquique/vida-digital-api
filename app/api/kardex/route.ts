import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");
  const empresaSlug = searchParams.get("empresaSlug");

  if (!codigo || !empresaSlug) {
    return NextResponse.json({ error: "Faltan parametros (codigo, empresaSlug)" }, { status: 400 });
  }

  const schema = empresaSlug === "sanjh" ? "sanjh" : "vida";

  try {
    const rows = schema === "sanjh"
      ? await sql`
          SELECT
            MIN(i.precreal) AS precio_minimo,
            MAX(i.precreal) AS precio_maximo,
            COUNT(*)::int AS total_ventas
          FROM sanjh.itemdcto i
          INNER JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
          WHERE m.tipomovi = 'V'
            AND i.precreal > 0
            AND i.cantsali > 0
            AND i.codunico = ${codigo}
        `
      : await sql`
          SELECT
            MIN(i.precreal) AS precio_minimo,
            MAX(i.precreal) AS precio_maximo,
            COUNT(*)::int AS total_ventas
          FROM vida.itemdcto i
          INNER JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
          WHERE m.tipomovi = 'V'
            AND i.precreal > 0
            AND i.cantsali > 0
            AND i.codunico = ${codigo}
        `;
    const row = rows && rows.length > 0 ? rows[0] : null;

    const totalVentas = row?.total_ventas !== undefined && row?.total_ventas !== null
      ? Number(row.total_ventas)
      : 0;

    return NextResponse.json({
      precio_minimo: row?.precio_minimo !== undefined && row?.precio_minimo !== null ? Number(row.precio_minimo) : null,
      precio_maximo: row?.precio_maximo !== undefined && row?.precio_maximo !== null ? Number(row.precio_maximo) : null,
      total_ventas: totalVentas,
    });
  } catch (error: any) {
    console.error("GET /api/kardex error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
