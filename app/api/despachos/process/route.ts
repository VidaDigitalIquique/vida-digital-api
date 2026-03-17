import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { uploadImage } from "@/lib/cloudinary";
import { extractFolioFromImage } from "@/lib/openrouter";

// Force Node runtime instead of edge because of Cloudinary and Node libraries
export const runtime = "nodejs";
// Prevent Vercel from timing out too early if possible (Max is 10s on free, maxDuration goes up to 60s on Pro)
export const maxDuration = 10; 

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { empresaId, imageBase64, filename } = await request.json();
  const preferredModel = request.headers.get('X-Preferred-Model') || 'auto';

  if (!empresaId || !imageBase64) {
    return NextResponse.json({ error: "Datos insuficientes (empresaId, imageBase64)" }, { status: 400 });
  }

  // Ensure user has access
  if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
    return NextResponse.json({ error: "Acceso denegado a esta empresa" }, { status: 403 });
  }

  // Fetch empresa slug for cloudinary folder structure
  const empresaRows = await sql`SELECT slug FROM empresas WHERE id = ${empresaId}`;
  if (empresaRows.length === 0) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  const empresaSlug = empresaRows[0].slug;

  try {
    // 1. Upload to Cloudinary to get a public URL for OpenRouter
    const uploadResult = await uploadImage(imageBase64, `despachos/${empresaSlug}`);
    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error("Fallo al subir imagen a Cloudinary");
    }

    const imageUrl = uploadResult.secure_url;
    const publicId = uploadResult.public_id;

    // 2. Extract Folio using OpenRouter AI
    let folio: number | null = null;
    try {
       folio = await extractFolioFromImage(imageUrl, preferredModel);
    } catch (aiError) {
       console.error(`AI Extract error for ${filename}:`, aiError);
       // We continue, just mark it as sin folio
    }

    const state = folio ? 'ok' : 'sin_folio';

    // 3. Save to Database
    const inserted = await sql`
      INSERT INTO despachos (
        empresa_id,
        folio,
        imagen_url,
        public_id,
        estado,
        fecha_despacho
      ) VALUES (
        ${empresaId},
        ${folio !== null ? folio : null},
        ${imageUrl},
        ${publicId},
        ${state},
        CURRENT_DATE
      )
      RETURNING *
    `;

    return NextResponse.json({ 
      data: inserted[0], 
      message: folio ? `Folio ${folio} detectado` : 'No se detectó folio',
      state 
    });

  } catch (error: any) {
    console.error(`POST /api/despachos/process [${filename}] error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
