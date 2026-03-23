import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_request?: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await sql`
    SELECT k.id, k.empresa_id, e.nombre as empresa_nombre,
           k.patron_nombre, k.descripcion, k.activo, k.created_at
    FROM kardex_clientes_excluidos k
    JOIN empresas e ON e.id = k.empresa_id
    ORDER BY k.empresa_id, k.patron_nombre
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { empresa_id, patron_nombre, descripcion } = body;

  if (!empresa_id || !patron_nombre) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO kardex_clientes_excluidos (empresa_id, patron_nombre, descripcion)
    VALUES (${empresa_id}, ${patron_nombre.trim().toUpperCase()}, ${descripcion || null})
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  await sql`DELETE FROM kardex_clientes_excluidos WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { id, activo } = body;

  if (!id || activo === undefined) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  await sql`UPDATE kardex_clientes_excluidos SET activo = ${activo} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
