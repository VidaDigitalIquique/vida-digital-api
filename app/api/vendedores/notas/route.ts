import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import flags from '@/config/feature-flags.json';
import { hoyCL } from '@/lib/fechas';
import { puedeVerVendedores } from '@/lib/roles';
import { empresasDe, fetchNotas, parsearFiltros } from '@/lib/vendedores-notas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rol = (session.user as unknown as { rol?: string })?.rol;
  if (!puedeVerVendedores(rol)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  if (!flags['vendedores-modulo']) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const empresas = empresasDe(searchParams.get('empresa'));
  if (!empresas) return NextResponse.json({ error: 'empresa inválida' }, { status: 400 });

  const parsed = parsearFiltros(searchParams, hoyCL());
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const data = await fetchNotas(empresas, parsed.filtros);
    return NextResponse.json({ ...data, limit: parsed.filtros.limit });
  } catch {
    return NextResponse.json({ error: 'Error al consultar notas' }, { status: 500 });
  }
}
