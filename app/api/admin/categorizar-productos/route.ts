import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { callGeminiText } from '@/lib/gemini';

const CATEGORIAS_VALIDAS = ['Ortopedia', 'Electrodomésticos', 'Deporte', 'Belleza', 'Médico', 'Vidrio', 'Juguetes'];

const BATCH_SIZE = 50;

interface ProductoBatch {
  codigo: string;
  detalle: string;
}

interface GeminiResultItem {
  codigo: string;
  categoria: string;
}

async function clasificarBatch(productos: ProductoBatch[]): Promise<GeminiResultItem[] | null> {
  const userPrompt =
    'Clasifica estos productos de una importadora chilena.\n' +
    'Categorías válidas ÚNICAMENTE: Ortopedia, Electrodomésticos, Deporte, Belleza, Médico, Vidrio, Juguetes.\n' +
    'Responde SOLO con un JSON array sin texto adicional, sin backticks, sin markdown.\n' +
    'Formato exacto: [{"codigo":"...","categoria":"..."}]\n' +
    'Productos: ' + JSON.stringify(productos.map(p => ({ codigo: p.codigo, detalle: p.detalle })));

  const raw = await callGeminiText(userPrompt, { temperature: 0, maxOutputTokens: 2000 });
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed: GeminiResultItem[] = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const user = session.user as any;
  if (user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso restringido a administradores' }, { status: 403 });
  }

  const productosRaw = await sql`
    SELECT codigo, detalle
    FROM public.productos
    WHERE categoria IS NULL
      AND detalle IS NOT NULL
      AND detalle != ''
  `;
  const productos = productosRaw as unknown as ProductoBatch[];

  const total = productos.length;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (data: object) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let procesados = 0;
      let categorizados = 0;
      let errores = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = productos.slice(i, i + BATCH_SIZE);

        const resultado = await clasificarBatch(batch);

        if (resultado === null) {
          errores += batch.length;
        } else {
          for (const item of resultado) {
            if (!CATEGORIAS_VALIDAS.includes(item.categoria)) continue;
            try {
              await sql`
                UPDATE public.productos
                SET categoria = ${item.categoria}
                WHERE codigo = ${item.codigo}
              `;
              categorizados++;
            } catch {
              errores++;
            }
          }
        }

        procesados += batch.length;
        emit({ tipo: 'progreso', procesados, total, categorizados });
      }

      emit({ tipo: 'fin', procesados: total, total, categorizados, errores });
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
