import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;

  try {
    const body = await request.json();
    const { ubicacion, fisico_cajas, fisico_unidades, observaciones } = body;
    const { id } = params;

    const existing = await sql`
      SELECT empresa_id, saldo, cantcaja 
      FROM ubicaciones_bodega 
      WHERE id = ${id}
    `;
    if (existing.length === 0) return NextResponse.json({ error: "Ubicacion no encontrada" }, { status: 404 });
    if (!user.empresas.includes(existing[0].empresa_id)) {
      return NextResponse.json({ error: "No tienes acceso a esta empresa" }, { status: 403 });
    }

    const saldo = existing[0].saldo;
    const cantcaja = existing[0].cantcaja || 1;

    // Compute fisico total in units and diferencia
    let fisicoTotal = null;
    let diferencia = null;
    const cajas = fisico_cajas !== undefined && fisico_cajas !== null ? parseInt(fisico_cajas) : null;
    const unidades = fisico_unidades !== undefined && fisico_unidades !== null ? parseInt(fisico_unidades) : 0;

    if (cajas !== null) {
      fisicoTotal = (cajas * cantcaja) + unidades;
      diferencia = fisicoTotal - saldo;
    }

    const updated = await sql`
      UPDATE ubicaciones_bodega
      SET
        ubicacion = COALESCE(${ubicacion !== undefined ? ubicacion : null}, ubicacion),
        fisico_cajas = ${cajas},
        fisico_unidades = ${fisico_unidades !== undefined && fisico_unidades !== null ? parseInt(fisico_unidades) : 0},
        fisico = ${fisicoTotal},
        diferencia = ${diferencia},
        observaciones = COALESCE(${observaciones !== undefined ? observaciones : null}, observaciones),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ data: updated[0], message: "Ubicación actualizada" });

  } catch (error: any) {
    console.error("PUT /api/ubicaciones/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
