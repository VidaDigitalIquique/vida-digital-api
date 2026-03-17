import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Get all users
    const userRows = await sql`
      SELECT id, rut, nombre, rol, activo, created_at FROM usuarios ORDER BY nombre ASC
    `;

    // Map enterprise associations
    const empRows = await sql`SELECT usuario_id, empresa_id FROM usuario_empresa`;
    
    const mapped = userRows.map(u => ({
      ...u,
      empresas: empRows.filter(e => e.usuario_id === u.id).map(e => e.empresa_id)
    }));

    return NextResponse.json({ data: mapped });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { rut, nombre, password, rol, empresas } = await request.json();

    if (!rut || !nombre || !password || !empresas || empresas.length === 0) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Insert User
    const inserted = await sql`
      INSERT INTO usuarios (rut, nombre, password, rol)
      VALUES (${rut}, ${nombre}, ${hashed}, ${rol || 'vendedor'})
      RETURNING id, rut, nombre, rol, activo
    `;

    const userId = inserted[0].id;

    // Insert Empresas
    for (const empId of empresas) {
       await sql`INSERT INTO usuario_empresa (usuario_id, empresa_id) VALUES (${userId}, ${empId})`;
    }

    return NextResponse.json({ data: { ...inserted[0], empresas } });
  } catch (error: any) {
     if (error.message.includes('unique constraint')) {
        return NextResponse.json({ error: "El RUT ya está registrado" }, { status: 400 });
     }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
