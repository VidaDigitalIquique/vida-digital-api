import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import flags from '@/config/feature-flags.json';
import { hoyCL } from '@/lib/fechas';
import { puedeVerVendedores } from '@/lib/roles';
import { schemaDeEmpresa } from '@/lib/ventas-producto';
import { fetchDetalleNota } from '@/lib/vendedores-notas';

export const dynamic = 'force-dynamic';

const NOTA_VALIDA = /^\d{1,10}$/;

type RouteContext = { params: { empresa: string; nota: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rol = (session.user as unknown as { rol?: string })?.rol;
  if (!puedeVerVendedores(rol)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  if (!flags['vendedores-modulo']) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // El esquema sale SOLO de la whitelist: nunca del texto del usuario.
  const esquema = schemaDeEmpresa(params.empresa);
  if (!esquema) return NextResponse.json({ error: 'empresa inválida' }, { status: 400 });
  if (!NOTA_VALIDA.test(params.nota)) return NextResponse.json({ error: 'nota inválida' }, { status: 400 });

  try {
    const detalle = await fetchDetalleNota(esquema, params.nota, hoyCL());
    if (!detalle) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(detalle);
  } catch (error) {
    console.error('GET /api/vendedores/notas/[empresa]/[nota] error:', error);
    return NextResponse.json({ error: 'Error al consultar el detalle' }, { status: 500 });
  }
}
