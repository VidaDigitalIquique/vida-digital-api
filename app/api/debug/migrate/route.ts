import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  // Only allow with a secret token
  const token = request.headers.get('x-migrate-token');
  const secret = process.env.MIGRATE_SECRET || 'fallback-secret-for-dev';
  
  if (!token || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized: Missing or invalid x-migrate-token' }, { status: 401 });
  }

  try {
    console.log("Starting migration: Updating unique constraints for multi-shipment (NROINGRESO) support");
    
    // 1. Products table
    await sql`ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_empresa_id_codigo_key;`;
    await sql`ALTER TABLE productos ADD CONSTRAINT productos_empresa_id_codigo_nroingreso_key UNIQUE (empresa_id, codigo, nroingreso);`;
    
    // 2. Warehouse locations table
    await sql`ALTER TABLE ubicaciones_bodega DROP CONSTRAINT IF EXISTS ubicaciones_bodega_empresa_id_codigo_key;`;
    await sql`ALTER TABLE ubicaciones_bodega ADD COLUMN IF NOT EXISTS nroingreso TEXT;`;
    await sql`UPDATE ubicaciones_bodega SET nroingreso = 'INICIAL' WHERE nroingreso IS NULL;`;
    await sql`ALTER TABLE ubicaciones_bodega ADD CONSTRAINT ubicaciones_bodega_empresa_id_codigo_nroingreso_key UNIQUE (empresa_id, codigo, nroingreso);`;

    return NextResponse.json({ 
      message: "Migración exitosa", 
      details: "Restricciones UNIQUE actualizadas en productos y ubicaciones_bodega (empresa_id, codigo, nroingreso)" 
    });
  } catch (err: any) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
