import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    console.log("Starting migration: Drop old constraint products_empresa_id_codigo_key");
    await sql`ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_empresa_id_codigo_key;`;
    
    console.log("Adding new constraint: products_empresa_id_codigo_nroingreso_key");
    await sql`ALTER TABLE productos ADD CONSTRAINT productos_empresa_id_codigo_nroingreso_key UNIQUE (empresa_id, codigo, nroingreso);`;

    return NextResponse.json({ message: "Migración exitosa: Restricción UNIQUE actualizada a (empresa_id, codigo, nroingreso)" });
  } catch (err: any) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
