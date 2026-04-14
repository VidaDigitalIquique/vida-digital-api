import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { uploadImage } from '@/lib/cloudinary';

export const runtime = 'nodejs';

type RouteContext = {
  params: {
    kcodclie: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const user = session.user as any;
  if (!['admin', 'supervisor'].includes(user.rol)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  const { kcodclie } = params;

  try {
    const { imageBase64, empresaId } = await request.json();

    if (!imageBase64 || !empresaId) {
      return NextResponse.json({ error: 'Faltan datos (imageBase64, empresaId)' }, { status: 400 });
    }

    const uploadResult = await uploadImage(imageBase64, 'clientes', kcodclie);
    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error('Fallo al subir imagen a Cloudinary');
    }

    const imageUrl = uploadResult.secure_url;

    await sql`
      INSERT INTO public.clientes_foto (empresa_id, kcodclie, imagen_url)
      VALUES (${empresaId}, ${kcodclie}, ${imageUrl})
      ON CONFLICT (empresa_id, kcodclie) DO UPDATE SET imagen_url = EXCLUDED.imagen_url
    `;

    return NextResponse.json({ imagen_url: imageUrl });
  } catch (error: any) {
    console.error(`POST /api/ventas/clientes/${kcodclie}/foto error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
