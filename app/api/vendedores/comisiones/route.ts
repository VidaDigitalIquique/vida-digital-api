import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import flags from '@/config/feature-flags.json';
import { hoyCL } from '@/lib/fechas';
import { puedeVerVendedores } from '@/lib/roles';
import { fetchComisiones, leerComisionPct } from '@/lib/comisiones';
import { mesDeHoy, mesValido } from '@/lib/comisiones-utils';

export const dynamic = 'force-dynamic';

async function autorizar(): Promise<{ error: NextResponse } | { usuarioId: number }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };

  const user = session.user as unknown as { rol?: string; id?: string };
  if (!puedeVerVendedores(user?.rol)) {
    return { error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) };
  }
  if (!flags['vendedores-modulo']) {
    return { error: NextResponse.json({ error: 'No encontrado' }, { status: 404 }) };
  }
  const usuarioId = Number(user?.id);
  if (!Number.isInteger(usuarioId) || usuarioId < 1) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }
  return { usuarioId };
}

export async function GET(request: Request) {
  const auth = await autorizar();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const hoy = hoyCL();
  const mesParam = searchParams.get('mes');
  const mes = mesParam === null ? mesDeHoy(hoy) : mesValido(mesParam);
  if (!mes) return NextResponse.json({ error: 'mes inválido' }, { status: 400 });

  try {
    const comisionPct = await leerComisionPct();
    return NextResponse.json(await fetchComisiones(mes, hoy, comisionPct));
  } catch (error) {
    console.error('GET /api/vendedores/comisiones error:', error);
    return NextResponse.json({ error: 'Error al consultar las comisiones' }, { status: 500 });
  }
}
