import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import flags from '@/config/feature-flags.json';
import { sql } from '@/lib/db';
import { hoyCL } from '@/lib/fechas';
import { puedeVerVendedores } from '@/lib/roles';
import { validarFiltrosGuardados } from '@/lib/vendedores-notas';
import type { FiltrosGuardados } from '@/lib/filtros-validacion';

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

function normalizarFiltros(valor: unknown): FiltrosGuardados | null {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as FiltrosGuardados;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as FiltrosGuardados)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET() {
  const auth = await autorizar();
  if ('error' in auth) return auth.error;

  try {
    const filas = (await sql.query(
      'SELECT filtros FROM public.vendedores_filtros WHERE usuario_id = $1',
      [auth.usuarioId]
    )) as Array<{ filtros?: unknown }>;
    return NextResponse.json({ filtros: normalizarFiltros(filas[0]?.filtros) });
  } catch (error) {
    console.error('GET /api/vendedores/filtros error:', error);
    return NextResponse.json({ error: 'Error al leer los filtros' }, { status: 500 });
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
  const parsed = validarFiltrosGuardados(raw, hoyCL());
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const filas = (await sql.query(
      `INSERT INTO public.vendedores_filtros (usuario_id, filtros, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (usuario_id) DO UPDATE SET filtros = EXCLUDED.filtros, updated_at = now()
       RETURNING filtros`,
      [auth.usuarioId, JSON.stringify(parsed.filtros)]
    )) as Array<{ filtros?: unknown }>;
    return NextResponse.json({ filtros: normalizarFiltros(filas[0]?.filtros) ?? parsed.filtros });
  } catch (error) {
    console.error('PUT /api/vendedores/filtros error:', error);
    return NextResponse.json({ error: 'Error al guardar los filtros' }, { status: 500 });
  }
}
