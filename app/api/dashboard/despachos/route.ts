import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateColumnas } from "@/app/(app)/dashboard/dashboard-utils";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const empresaIds = searchParams.getAll('empresaId').map(Number).filter(Boolean);

  if (!empresaIds.length) {
    return NextResponse.json({ error: "Falta empresaId" }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, folio, imagen_url, created_at
    FROM public.despachos_bodega
    WHERE empresa_id = ANY(${empresaIds})
      AND created_at >= (CURRENT_DATE AT TIME ZONE 'America/Santiago') - INTERVAL '5 days'
    ORDER BY created_at DESC
  `;

  const columnas = generateColumnas(rows);
  return NextResponse.json({ columnas });
}
