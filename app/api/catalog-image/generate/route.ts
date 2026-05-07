import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { callGeminiImage } from '@/lib/gemini';
import { uploadImage } from '@/lib/cloudinary';
import sharp from 'sharp';

export const maxDuration = 30;

const VALID_POSITIONS = ['top-center', 'bottom-center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const VALID_COLORS = ['white', 'black'];

const PROMPT = `You are a professional product photographer.
Transform these warehouse/inspection photos into a professional catalog image.
Requirements:
- Elegant studio or lifestyle background (kitchen, home setting, or neutral gradient)
- Arrange all color variants side by side or in an aesthetically pleasing composition
- Professional lighting with soft shadows
- Clean, high-quality e-commerce style
- Do NOT add any text, watermarks, labels or numbers to the image
- Preserve the actual colors and details of the products shown
Output: a single high-quality catalog image showing all variants.`;

const GRAVITY_MAP: Record<string, string> = {
  'top-center': 'north',
  'bottom-center': 'south',
  'top-left': 'northwest',
  'top-right': 'northeast',
  'bottom-left': 'southwest',
  'bottom-right': 'southeast',
};

function buildTextOverlay(
  productCode: string,
  packingText: string,
  colors: string | undefined,
  textColor: string,
  imageWidth: number,
): Buffer {
  const isWhite = textColor === 'white';
  const fill = isWhite ? 'white' : 'black';
  const stroke = isWhite ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const codeSize = Math.round(imageWidth * 0.05);
  const detailSize = Math.round(imageWidth * 0.025);

  const lines: string[] = [];
  lines.push(`<tspan x="50%" dy="0" font-weight="bold" font-size="${codeSize}px">${productCode}</tspan>`);
  lines.push(`<tspan x="50%" dy="${codeSize + 8}" font-weight="600" font-size="${detailSize}px">${packingText}</tspan>`);
  if (colors) {
    lines.push(`<tspan x="50%" dy="${detailSize + 4}" font-weight="400" font-size="${detailSize}px">Colores: ${colors}</tspan>`);
  }

  const totalLines = lines.length;
  const svgHeight = codeSize + (totalLines - 1) * (detailSize + 4) + 40;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${svgHeight}">
    <style>
      text {
        font-family: Arial, Helvetica, sans-serif;
        text-anchor: middle;
        paint-order: stroke;
        stroke: ${stroke};
        stroke-width: 2px;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: ${fill};
      }
    </style>
    <text y="50%">${lines.join('')}</text>
  </svg>`;

  return Buffer.from(svg);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rol = (session.user as any).rol;
  if (!['admin', 'vendedor'].includes(rol)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  try {
    const {
      images,
      mimeTypes,
      productCode,
      packingText,
      colors,
      textPosition,
      textColor,
      uploadToCloudinary,
    } = await request.json();

    if (!images?.length || !productCode?.trim() || !packingText?.trim()) {
      return NextResponse.json({ error: 'images, productCode y packingText son requeridos' }, { status: 400 });
    }
    if (!VALID_POSITIONS.includes(textPosition)) {
      return NextResponse.json({ error: 'textPosition inválido' }, { status: 400 });
    }
    if (!VALID_COLORS.includes(textColor)) {
      return NextResponse.json({ error: 'textColor inválido' }, { status: 400 });
    }

    // 1. Generar imagen con Gemini
    const imageBuffer = await callGeminiImage(images, mimeTypes || [], PROMPT);
    if (!imageBuffer) {
      return NextResponse.json({ error: 'Gemini no pudo generar la imagen' }, { status: 500 });
    }

    // 2. Obtener dimensiones para el overlay
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width || 1200;

    // 3. Superponer texto con Sharp
    const overlay = buildTextOverlay(productCode.trim(), packingText.trim(), colors?.trim() || undefined, textColor, imageWidth);
    const gravity = GRAVITY_MAP[textPosition] || 'north';
    const finalBuffer = await sharp(imageBuffer)
      .composite([{ input: overlay, gravity }])
      .jpeg({ quality: 90 })
      .toBuffer();

    // 4. Subir o retornar preview
    if (uploadToCloudinary) {
      const base64 = 'data:image/jpeg;base64,' + finalBuffer.toString('base64');
      const result = await uploadImage(base64, 'productos', productCode.trim());
      if (!result?.secure_url) {
        return NextResponse.json({ error: 'Fallo al subir a Cloudinary' }, { status: 500 });
      }

      await sql`
        UPDATE productos
        SET imagen_url = ${result.secure_url}, public_id = ${result.public_id}, updated_at = NOW()
        WHERE codigo = ${productCode.trim()}
      `;

      return NextResponse.json({ result_url: result.secure_url, public_id: result.public_id });
    }

    const dataUrl = 'data:image/jpeg;base64,' + finalBuffer.toString('base64');
    return NextResponse.json({ result_url: dataUrl, public_id: null });
  } catch (error: any) {
    console.error('POST /api/catalog-image/generate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
