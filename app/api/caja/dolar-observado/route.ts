import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDolarObservado } from "@/lib/bcentral";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const result = await getDolarObservado();
    if (!result) {
      return NextResponse.json(
        { error: "No se pudo obtener el dólar observado" },
        { status: 502 }
      );
    }
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
