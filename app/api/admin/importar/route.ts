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
    const body = await request.json();
    const { empresaNombre, products } = body;

    if (!empresaNombre || !products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "Datos de importación inválidos o bloque vacío" }, { status: 400 });
    }

    const rows = await sql`SELECT id FROM empresas WHERE nombre = ${empresaNombre}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Empresa no reconocida" }, { status: 400 });
    }
    const eid = rows[0].id;

    if (!(session.user as any).empresas.includes(Number(eid))) {
      return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
    }

    let upserted = 0;

    for (const p of products) {
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

      await sql`
        INSERT INTO ubicaciones_bodega (empresa_id, codigo, nroingreso, detalle, saldo, cantcaja)
        VALUES (${eid}, ${codigo}, ${nroingreso}, ${detalle}, ${saldo}, ${cantcaja})
        ON CONFLICT ON CONSTRAINT ubicaciones_bodega_empresa_id_codigo_nroingreso_key
        DO UPDATE SET
          detalle = EXCLUDED.detalle,
          saldo = EXCLUDED.saldo,
          cantcaja = EXCLUDED.cantcaja,
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
