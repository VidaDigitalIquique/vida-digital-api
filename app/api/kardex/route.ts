import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { ventasDeProducto, type EmpresaVentas } from "@/lib/ventas-producto";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");
  const empresaSlug = searchParams.get("empresaSlug");

  if (!codigo || !empresaSlug) {
    return NextResponse.json({ error: "Faltan parametros (codigo, empresaSlug)" }, { status: 400 });
  }

  // Se conserva el comportamiento historico: todo lo que no sea sanjh usa vida
  // (lo consumen ProductCard y /ventas/kardex con empresaSlug=vida).
  const schema: EmpresaVentas = empresaSlug === "sanjh" ? "sanjh" : "vida";

  try {
    const { ventas, patronesExcluidos } = await ventasDeProducto(schema, codigo);

    if (ventas.length === 0) {
      return NextResponse.json({
        precio_minimo: null,
        precio_maximo: null,
        precio_medio: null,
        precio_medio_status: 'sin_ventas',
        total_ventas: 0,
        clientes_excluidos: patronesExcluidos,
      });
    }

    const precios = ventas.map(v => v.precio);
    const precioMin = Math.min(...precios);
    const precioMax = Math.max(...precios);
    const totalVentas = ventas.length;

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
      clientes_excluidos: patronesExcluidos,
    });
  } catch (error) {
    console.error("GET /api/kardex error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
