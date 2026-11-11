import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import flags from '@/config/feature-flags.json';
import { hoyCL } from '@/lib/fechas';
import { puedeVerVendedores } from '@/lib/roles';
import { fetchComisiones, guardarComisionPct, leerComisionPct } from '@/lib/comisiones';
import { mesDeHoy, mesValido, validarPct } from '@/lib/comisiones-utils';

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

export async function PUT(request: Request) {
  const auth = await autorizar();
  if ('error' in auth) return auth.error;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'datos inválidos' }, { status: 400 });
  }
  const obj = raw as Record<string, unknown>;
  const hoy = hoyCL();
  const mes = obj.mes === undefined || obj.mes === null
    ? mesDeHoy(hoy)
    : typeof obj.mes === 'string'
      ? mesValido(obj.mes)
      : null;
  if (!mes) return NextResponse.json({ error: 'mes inválido' }, { status: 400 });

  const comisionPct = validarPct(obj.comision_pct);
  if (comisionPct === null) return NextResponse.json({ error: 'porcentaje inválido' }, { status: 400 });

  try {
    const guardado = await guardarComisionPct(comisionPct, auth.usuarioId);
    return NextResponse.json(await fetchComisiones(mes, hoy, guardado));
  } catch (error) {
    console.error('PUT /api/vendedores/comisiones error:', error);
    return NextResponse.json({ error: 'Error al guardar las comisiones' }, { status: 500 });
  }
}
