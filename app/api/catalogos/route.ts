import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateSlug } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as any).id;

  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('empresa');

  if (!empresaId) return NextResponse.json({ error: "Falta empresa_id" }, { status: 400 });

  if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
    return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
  }

  try {
    const catalogos = await sql`
      SELECT * FROM catalogos 
      WHERE user_id = ${userId}
        AND (empresa_id = ${empresaId} OR ambas_empresas = true)
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ data: catalogos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as any).id;

  try {
    const { empresaId, titulo, descripcion, mostrar_precio, margen_precio, solo_stock, solo_nuevo, palabras_incluir, palabras_excluir, ambas_empresas, categoria } = await request.json();

    if (!empresaId || !titulo) return NextResponse.json({ error: "Datos requeridos faltantes" }, { status: 400 });

    if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
      return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
    }

    // Generate unique slug
    const baseSlug = generateSlug(titulo);
    const shortId = Math.floor(Math.random() * 90000) + 10000;
    const slug = `${baseSlug}-${shortId}`;

    const inserted = await sql`
      INSERT INTO catalogos (empresa_id, user_id, slug, titulo, descripcion, activo, mostrar_precio, margen_precio, solo_stock, solo_nuevo, palabras_incluir, palabras_excluir, ambas_empresas, categoria)
      VALUES (
        ${empresaId}, ${userId}, ${slug}, ${titulo}, ${descripcion || null}, true,
        ${mostrar_precio ?? true}, ${margen_precio ?? 0}, ${solo_stock ?? false}, ${solo_nuevo ?? false},
        ${palabras_incluir || ''}, ${palabras_excluir || ''}, ${ambas_empresas ?? true}, ${categoria ?? null}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: inserted[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
