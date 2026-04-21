import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateSlug } from '@/lib/utils';

const TIPO_PRECIO_VALIDOS = ['max', 'min', 'ultimo', 'costo_mas_margen', 'sin_precio'] as const;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as any).id;

  try {
    const catalogos = await sql`
      SELECT * FROM catalogos
      WHERE user_id = ${userId} AND kcodclie IS NOT NULL
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: catalogos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as any).id;

  try {
    const {
      empresaId, titulo, kcodclie, tipo_precio,
      solo_stock, mostrar_precio, margen_precio,
      ambas_empresas, descripcion,
    } = await request.json();

    if (!empresaId || !titulo || !kcodclie) {
      return NextResponse.json({ error: 'Datos requeridos faltantes' }, { status: 400 });
    }

    const tipoPrecioFinal = TIPO_PRECIO_VALIDOS.includes(tipo_precio) ? tipo_precio : 'max';

    const baseSlug = generateSlug(titulo);
    const shortId = Math.floor(Math.random() * 90000) + 10000;
    const slug = `${baseSlug}-${shortId}`;

    const inserted = await sql`
      INSERT INTO catalogos (
        empresa_id, user_id, slug, titulo, descripcion, activo,
        mostrar_precio, margen_precio, solo_stock, solo_nuevo,
        palabras_incluir, palabras_excluir, ambas_empresas, categoria,
        kcodclie, tipo_precio
      )
      VALUES (
        ${empresaId}, ${userId}, ${slug}, ${titulo}, ${descripcion ?? null}, true,
        ${mostrar_precio ?? true}, ${margen_precio ?? 0}, ${solo_stock ?? false}, false,
        '', '', ${ambas_empresas ?? true}, null,
        ${kcodclie}, ${tipoPrecioFinal}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: inserted[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
