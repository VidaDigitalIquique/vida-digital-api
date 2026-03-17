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
    const { ubicacion, fisico, observaciones } = body;
    const { id } = params;

    const existing = await sql`SELECT empresa_id, saldo, cantcaja FROM ubicaciones_bodega WHERE id = ${id}`;
    if (existing.length === 0) return NextResponse.json({ error: "Ubicacion no encontrada" }, { status: 404 });
    
    if (!user.empresas.includes(existing[0].empresa_id)) {
      return NextResponse.json({ error: "No tienes acceso a esta empresa" }, { status: 403 });
    }

    // Logic: 
    // fisico -> physical count entered by user
    // diferencia = fisico - saldo
    // saldocajas is already computed, but if saldo changes, we compute it. we are not changing saldo here, just physical.
    // If Admin/Supervisor wants to override the saldo later, they can, but this endpoint is for physical updates.

    const saldo = existing[0].saldo;
    const cantcaja = existing[0].cantcaja;
    
    let diferencia = null;
    let fisicoActualizado = null;

    if (fisico !== undefined && fisico !== null && fisico !== "") {
      fisicoActualizado = parseFloat(fisico);
      diferencia = fisicoActualizado - saldo;
    }
    
    const updated = await sql`
      UPDATE ubicaciones_bodega 
      SET 
        ubicacion = COALESCE(${ubicacion !== undefined ? ubicacion : null}, ubicacion),
        fisico = ${fisicoActualizado !== null ? fisicoActualizado : null},
        diferencia = ${diferencia !== null ? diferencia : null},
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
