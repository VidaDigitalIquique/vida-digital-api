import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { recalculateNuevoFlags } from "@/lib/services/product-service";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'supervisor'].includes((session.user as any).rol)) {
    return NextResponse.json({ error: "No autorizado para importar" }, { status: 401 });
  }

  try {
    // Diagnostic query requested by USER
    const state = await sql`
      SELECT e.nombre, e.id, COUNT(p.id) as total_productos 
      FROM empresas e 
      LEFT JOIN productos p ON p.empresa_id = e.id 
      GROUP BY e.id, e.nombre;
    `;
    console.log('Current DB State (Products by Company):', JSON.stringify(state, null, 2));

    const body = await request.json();
    console.log('Body keys received:', Object.keys(body));
    console.log('empresaId:', body.empresaId);
    console.log('products length:', body.products?.length);
    console.log('First product sample:', body.products?.[0]);

    const { empresaId, products } = body;

    if (empresaId === undefined || empresaId === null || !products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "Datos de importación inválidos o bloque vacío" }, { status: 400 });
    }

    if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
      return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
    }

    // Upsert products one by one to ensure we don't blow up neon connection or limits
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
      const nroingreso = p.nroingreso ? String(p.nroingreso).trim().toUpperCase() : 'INICIAL';
      const umed = p.umed ? String(p.umed).trim().toUpperCase() : 'UN';

      // Upsert using proper tagged template literals with (empresa_id, codigo, nroingreso) conflict target
      await sql`
        INSERT INTO productos (
          empresa_id, codigo, detalle, prcventa, prcminimo, costo, cif, 
          saldo, cantcaja, pesocaja, cubicaja, nroingreso, umed, es_nuevo, fecha_ingreso
        ) VALUES (
          ${eid}, ${codigo}, ${detalle}, ${prcventa}, ${prcminimo}, ${costo}, ${cif},
          ${saldo}, ${cantcaja}, ${pesocaja}, ${cubicaja}, ${nroingreso}, ${umed}, true, NOW()
        )
        ON CONFLICT ON CONSTRAINT productos_empresa_id_codigo_nroingreso_key DO UPDATE SET
          detalle = EXCLUDED.detalle,
          prcventa = EXCLUDED.prcventa,
          prcminimo = EXCLUDED.prcminimo,
          costo = EXCLUDED.costo,
          cif = EXCLUDED.cif,
          saldo = EXCLUDED.saldo,
          cantcaja = EXCLUDED.cantcaja,
          pesocaja = EXCLUDED.pesocaja,
          cubicaja = EXCLUDED.cubicaja,
          umed = EXCLUDED.umed,
          updated_at = NOW()
      `;
      
      upserted++;
    }

    const nuevoCount = await recalculateNuevoFlags(eid);

    return NextResponse.json({ 
      message: "Importación completada con éxito", 
      count: upserted,
      nuevoCount 
    });

  } catch (error: any) {
    console.error("POST /api/admin/importar error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
