import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { schemaDeEmpresa, ventasDeProducto } from "@/lib/ventas-producto";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as { rol?: string }).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");
  const empresaSlug = searchParams.get("empresaSlug");

  if (!codigo?.trim() || !empresaSlug) {
    return NextResponse.json({ error: "Faltan parametros (codigo, empresaSlug)" }, { status: 400 });
  }

  const schema = schemaDeEmpresa(empresaSlug);
  if (!schema) {
    return NextResponse.json({ error: "empresaSlug invalido" }, { status: 400 });
  }

  try {
    const { ventas } = await ventasDeProducto(schema, codigo);
    return NextResponse.json({ ventas });
  } catch (error) {
    console.error("GET /api/kardex/ventas error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
