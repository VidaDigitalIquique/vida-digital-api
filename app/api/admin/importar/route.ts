import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'supervisor'].includes((session.user as any).rol)) {
    return NextResponse.json({ error: "No autorizado para importar" }, { status: 401 });
  }

  try {
    const { empresaId, products } = await request.json();

    if (!empresaId || !products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "Datos de importación inválidos" }, { status: 400 });
    }

    if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
      return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
    }

    // Upsert products one by one to ensure we don't blow up neon connection or limits
    // Neon HTTP can handle moderate parallelization; we use chunking in real apps, loop simplifies demo
    let upserted = 0;
    const eid = parseInt(empresaId, 10);

    for (const p of products) {
      // Normalize values
      const codigo = String(p.codigo).trim().toUpperCase();
      const detalle = String(p.detalle || '').trim();
      const prcventa = parseFloat(p.prcventa) || 0;
      const prcminimo = parseFloat(p.prcminimo) || 0;
      const costo = parseFloat(p.costo) || 0;
      const cif = parseFloat(p.cif) || 0;
      const saldo = parseFloat(p.saldo) || 0;
      const cantcaja = parseFloat(p.cantcaja) || 1; 
      const pesocaja = parseFloat(p.pesocaja) || 0;
      const cubicaja = parseFloat(p.cubicaja) || 0;
      const nroingreso = p.nroingreso ? String(p.nroingreso).trim() : null;
      const umed = p.umed ? String(p.umed).trim().toUpperCase() : 'UN';

      const saldocajas = cantcaja > 0 ? saldo / cantcaja : 0;

      // Upsert using proper tagged template literals
      await sql`
        INSERT INTO productos (
          empresa_id, codigo, detalle, prcventa, prcminimo, costo, cif, 
          saldo, saldocajas, cantcaja, pesocaja, cubicaja, nroingreso, umed, es_nuevo, fecha_ingreso
        ) VALUES (
          ${eid}, ${codigo}, ${detalle}, ${prcventa}, ${prcminimo}, ${costo}, ${cif},
          ${saldo}, ${saldocajas}, ${cantcaja}, ${pesocaja}, ${cubicaja}, ${nroingreso}, ${umed}, true, NOW()
        )
        ON CONFLICT (empresa_id, codigo) DO UPDATE SET
          detalle = EXCLUDED.detalle,
          prcventa = EXCLUDED.prcventa,
          prcminimo = EXCLUDED.prcminimo,
          costo = EXCLUDED.costo,
          cif = EXCLUDED.cif,
          saldo = EXCLUDED.saldo,
          saldocajas = EXCLUDED.saldocajas,
          cantcaja = EXCLUDED.cantcaja,
          pesocaja = EXCLUDED.pesocaja,
          cubicaja = EXCLUDED.cubicaja,
          nroingreso = EXCLUDED.nroingreso,
          umed = EXCLUDED.umed,
          updated_at = NOW()
      `;
      
      upserted++;
    }

    return NextResponse.json({ message: "Importación completada con éxito", count: upserted });

  } catch (error: any) {
    console.error("POST /api/admin/importar error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
