import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import flags from '@/config/feature-flags.json';
import { hoyCL } from '@/lib/fechas';
import { puedeVerVendedores } from '@/lib/roles';
import { fechaValida, parsearEstado } from '@/lib/filtros-validacion';
import { fetchGanancia, parsearAgrupacion, rangoPorDefecto } from '@/lib/vendedores-ganancia';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const user = session.user as unknown as { rol?: string };
  if (!puedeVerVendedores(user?.rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }
  if (!flags['vendedores-ganancia-periodo']) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const agrupacion = parsearAgrupacion(searchParams.get('agrupar') ?? 'dia');
  if (!agrupacion) return NextResponse.json({ error: 'agrupar inválido' }, { status: 400 });

  const estado = parsearEstado(searchParams.get('estado') ?? 'todas');
  if (!estado) return NextResponse.json({ error: 'estado inválido' }, { status: 400 });

  const hoy = hoyCL();
  const defaults = rangoPorDefecto(agrupacion, hoy);
  const desde = searchParams.get('desde') ?? defaults.desde;
  const hasta = searchParams.get('hasta') ?? defaults.hasta;
  if (!fechaValida(desde) || !fechaValida(hasta)) {
    return NextResponse.json({ error: 'fecha inválida' }, { status: 400 });
  }
  if (desde > hasta) return NextResponse.json({ error: 'rango inválido' }, { status: 400 });

  try {
    return NextResponse.json(await fetchGanancia(agrupacion, desde, hasta, estado, hoy));
  } catch (error) {
    console.error('GET /api/vendedores/ganancia error:', error);
    return NextResponse.json({ error: 'Error al consultar la ganancia' }, { status: 500 });
  }
}
