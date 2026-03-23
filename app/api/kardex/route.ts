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
    // Get exclusion patterns for this empresa
    const exclusiones = schema === 'sanjh'
      ? await sql`SELECT patron_nombre FROM kardex_clientes_excluidos WHERE empresa_id = 1 AND activo = true`
      : await sql`SELECT patron_nombre FROM kardex_clientes_excluidos WHERE empresa_id = 2 AND activo = true`;
    const patrones = exclusiones.map((e: any) => e.patron_nombre as string);

    // Fetch all sales for this product
    const allRows = schema === 'sanjh'
      ? await sql`
          SELECT i.precread, m.cliente
          FROM sanjh.itemdcto i
          INNER JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
          WHERE m.tipomovi = 'V'
            AND i.precread > 0
            AND i.cantsali > 0
            AND i.codunico = ${codigo}
        `
      : await sql`
          SELECT i.precread, m.cliente
          FROM vida.itemdcto i
          INNER JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
          WHERE m.tipomovi = 'V'
            AND i.precread > 0
            AND i.cantsali > 0
            AND i.codunico = ${codigo}
        `;

    // Filter excluded clients in JS
    const filteredRows = patrones.length > 0
      ? allRows.filter((r: any) =>
          !patrones.some(p => r.cliente?.toUpperCase().includes(p.toUpperCase()))
        )
      : allRows;

    if (filteredRows.length === 0) {
      return NextResponse.json({
        precio_minimo: null,
        precio_maximo: null,
        precio_medio: null,
        precio_medio_status: 'sin_ventas',
        total_ventas: 0,
        clientes_excluidos: patrones.length,
      });
    }

    const precios = filteredRows.map((r: any) => Number(r.precread));
    const precioMin = Math.min(...precios);
    const precioMax = Math.max(...precios);
    const totalVentas = filteredRows.length;

    // Precio medio logic
    let precioMedio: number | null = null;
    let precioMedioStatus: string;

    if (precioMin === precioMax) {
      precioMedioStatus = 'sin_variacion';
    } else {
      const preciosUnicos: number[] = [];
      for (const p of precios) {
        if (!preciosUnicos.includes(p)) preciosUnicos.push(p);
      }
      preciosUnicos.sort((a, b) => a - b);
      if (preciosUnicos.length === 2) {
        precioMedioStatus = 'solo_dos';
      } else {
        const puntoMedio = (precioMin + precioMax) / 2;
        // Find closest real value to punto_medio
        const conDistancia = preciosUnicos.map(p => ({ precio: p, dist: Math.abs(p - puntoMedio) }));
        conDistancia.sort((a, b) => a.dist - b.dist);
        const minDist = conDistancia[0].dist;
        const candidatos = conDistancia.filter(p => p.dist === minDist);
        if (candidatos.length > 1) {
          precioMedioStatus = 'empate';
        } else {
          precioMedio = candidatos[0].precio;
          precioMedioStatus = 'ok';
        }
      }
    }

    return NextResponse.json({
      precio_minimo: precioMin,
      precio_maximo: precioMax,
      precio_medio: precioMedio,
      precio_medio_status: precioMedioStatus,
      total_ventas: totalVentas,
      clientes_excluidos: patrones.length,
    });
  } catch (error: any) {
    console.error("GET /api/kardex error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
