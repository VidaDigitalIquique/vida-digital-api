import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const user = session.user as any;

  try {
    const body = await request.json();
    const { updates, empresaId } = body; 
    // updates should be { id, fisico, observaciones }[]

    if (!empresaId || !updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    if (!user.empresas.includes(parseInt(empresaId, 10))) {
      return NextResponse.json({ error: "Empresa no autorizada o mismatch" }, { status: 403 });
    }

    let successCount = 0;
    
    // Process updates sequentially to avoid connection pool exhaustion
    for (const u of updates) {
        // verify enterprise matches inside the DB
        const existing = await sql`SELECT saldo, empresa_id FROM ubicaciones_bodega WHERE id = ${u.id}`;
        
        if (existing.length === 1 && existing[0].empresa_id === parseInt(empresaId, 10)) {
            const saldo = existing[0].saldo;
            let fisicoActualizado = null;
            let diferencia = null;

            if (u.fisico !== undefined && u.fisico !== null && u.fisico !== "") {
               fisicoActualizado = parseFloat(u.fisico);
               diferencia = fisicoActualizado - saldo;
            }

            // Execute sequentially
            await sql`
              UPDATE ubicaciones_bodega 
              SET 
                fisico = ${fisicoActualizado !== null ? fisicoActualizado : null},
                diferencia = ${diferencia !== null ? diferencia : null},
                observaciones = COALESCE(${u.observaciones !== undefined ? u.observaciones : null}, observaciones),
                updated_at = NOW()
              WHERE id = ${u.id}
            `;
            successCount++;
        }
    }

    return NextResponse.json({ message: `${successCount} registros actualizados` });

  } catch (error: any) {
    console.error("POST /api/inventario/bulk-save error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
