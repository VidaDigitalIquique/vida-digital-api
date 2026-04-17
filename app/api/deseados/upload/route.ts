export const runtime = 'nodejs';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { uploadImage } from '@/lib/cloudinary';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;
  if (!session || !['admin', 'supervisor', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { deseadoId, imageBase64 } = await request.json();

    if (!deseadoId || !imageBase64) {
      return NextResponse.json({ error: 'deseadoId e imageBase64 son requeridos' }, { status: 400 });
    }

    const existing = await sql`SELECT id, codigo FROM productos_deseados WHERE id = ${deseadoId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Deseado no encontrado' }, { status: 404 });
    }

    const deseado = existing[0];
    const publicId = deseado.codigo ? `deseado-${deseado.codigo}` : `deseado-${deseado.id}`;

    const result = await uploadImage(imageBase64, 'deseados', publicId);

    const rows = await sql`
      UPDATE productos_deseados
      SET imagen_url = ${result.secure_url}, imagen_public_id = ${result.public_id}, updated_at = NOW()
      WHERE id = ${deseadoId}
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    console.error('POST /api/deseados/upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
