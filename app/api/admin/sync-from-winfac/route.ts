import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { recalculateNuevoFlags } from '@/lib/services/product-service';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'supervisor'].includes((session.user as any).rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const sanjhResult = await sql`
      WITH updated AS (
        UPDATE public.productos AS prod SET
          saldo      = inv.stocdisp,
          cif        = inv.cifunita,
          costo      = inv.cosunita,
          cantcaja   = inv.cantcaja,
          pesocaja   = inv.pesocaja,
          cubicaja   = inv.cubicaja,
          umed       = inv.desunida,
          updated_at = NOW()
        FROM sanjh.inventar inv
        WHERE prod.codigo = inv.codunico
          AND prod.nroingreso = inv.knumezet
          AND prod.empresa_id = 1
        RETURNING prod.id
      )
      SELECT COUNT(*)::int as count FROM updated
    `;

    const vidaResult = await sql`
      WITH updated AS (
        UPDATE public.productos AS prod SET
          saldo      = inv.stocdisp,
          cif        = inv.cifunita,
          costo      = inv.cosunita,
          cantcaja   = inv.cantcaja,
          pesocaja   = inv.pesocaja,
          cubicaja   = inv.cubicaja,
          umed       = inv.desunida,
          updated_at = NOW()
        FROM vida.inventar inv
        WHERE prod.codigo = inv.codunico
          AND prod.nroingreso = inv.knumezet
          AND prod.empresa_id = 2
        RETURNING prod.id
      )
      SELECT COUNT(*)::int as count FROM updated
    `;

    const sanjh_count = Number(sanjhResult?.[0]?.count ?? 0);
    const vida_count = Number(vidaResult?.[0]?.count ?? 0);

    await recalculateNuevoFlags(1);
    await recalculateNuevoFlags(2);

    return NextResponse.json({
      message: 'Sincronizacion completada con exito',
      sanjh_count,
      vida_count,
    });
  } catch (error: any) {
    console.error('POST /api/admin/sync-from-winfac error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
