import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { uploadImage } from '@/lib/cloudinary';
import { callGeminiText } from '@/lib/gemini';

const NULL_RESPONSES = new Set(['null', '0', '00', '000', '', 'none', 'n/a']);

async function callGemini(b64Image: string, mime: string): Promise<string> {
  const sysPrompt =
    'Eres un asistente especializado en leer documentos comerciales chilenos. ' +
    'Tu unica tarea es encontrar el numero de folio, nota de venta o guia de despacho. ' +
    'Este numero suele aparecer en la parte superior, etiquetado como N, Folio, Nota N o Guia N. ' +
    'Ignora RUTs, telefonos, fechas y cualquier otro numero. ' +
    'Responde SOLO con los digitos del numero de folio, sin espacios ni puntos. ' +
    'Si no puedes identificarlo con certeza, responde exactamente: NULL';

  const text = await callGeminiText(
    'Cual es el numero de folio/nota/guia de este documento? Responde SOLO digitos o NULL.',
    {
      temperature: 0,
      maxOutputTokens: 50,
      systemInstruction: sysPrompt,
      images: [{ base64: b64Image, mimeType: mime }],
    },
  );
  if (!text) return 'NULL';
  if (NULL_RESPONSES.has(text.toLowerCase())) return 'NULL';
  return text;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { imageBase64, mimeType, empresaId } = body;

    if (!imageBase64 || !mimeType || !empresaId) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // 1. Llamar a Gemini para identificar el folio
    const folio = await callGemini(imageBase64, mimeType);

    if (folio === 'NULL') {
      return NextResponse.json({ error: 'No se pudo identificar el folio', folio: null }, { status: 422 });
    }

    // 2. Subir imagen a Cloudinary en carpeta despachos/
    const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const publicId = `${fecha}/${folio}_${Date.now()}`;
    const uploadResult = await uploadImage(
      `data:${mimeType};base64,${imageBase64}`,
      'despachos',
      publicId,
    );

    // 3. Guardar en Neon
    const subidoPor = (session.user as any)?.name ?? (session.user as any)?.email ?? 'desconocido';
    await sql`
      INSERT INTO public.despachos_bodega (folio, imagen_url, empresa_id, subido_por)
      VALUES (${folio}, ${uploadResult.secure_url}, ${empresaId}, ${subidoPor})
    `;

    return NextResponse.json({ ok: true, folio, imagen_url: uploadResult.secure_url });
  } catch (error: any) {
    console.error('POST /api/despachos/procesar error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
