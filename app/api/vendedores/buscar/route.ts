import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import flags from '@/config/feature-flags.json';
import { hoyCL } from '@/lib/fechas';
import { puedeVerVendedores } from '@/lib/roles';
import { buscarNotas } from '@/lib/vendedores-notas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rol = (session.user as unknown as { rol?: string })?.rol;
  if (!puedeVerVendedores(rol)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  if (!flags['vendedores-buscador']) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const q = new URL(request.url).searchParams.get('q') ?? '';
  // Menos de 2 caracteres: se responde vacio mientras el usuario tipea, sin tocar la base.
  if (q.trim().length < 2) return NextResponse.json({ notas: [] });

  try {
    return NextResponse.json(await buscarNotas(q, hoyCL()));
  } catch (error) {
    console.error('GET /api/vendedores/buscar error:', error);
    return NextResponse.json({ error: 'Error al consultar notas' }, { status: 500 });
  }
}
