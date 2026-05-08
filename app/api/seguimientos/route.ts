import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function guard(session: any) {
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rol = (session.user as any).rol;
  if (rol !== 'admin' && rol !== 'vendedor') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  return null;
}

function fmt(rows: any[]) {
  return rows.map(r => ({
    empresa: r.empresa,
    knumfoli: r.knumfoli,
    fechanvt: r.fechanvt,
    id_tdocu: r.id_tdocu,
    vendedor: r.vendedor,
    cliente_comprador: { kcodclie: r.kcodclie, nombress: r.nombress, celular: r.celular, email01: r.email01, ciudad: r.ciudad },
    cliente_factura: r.kcodcli2 ? { kcodclie: r.kcodcli2, nombress: r.factura_nombre } : null,
    items: r.items ?? [],
    seguimiento: r.seg_id ? { id: r.seg_id, prioridad: r.prioridad, estado: r.estado, asignado_a: r.asignado_a, notas_internas: r.notas_internas, ultima_interaccion: r.ultima_interaccion, proximo_contacto: r.proximo_contacto } : null,
  }));
}

async function queryNotas(schema: 'vida' | 'sanjh', vendedor: string | null, knumfoli: string | null, mes: number | null, anio: number | null) {
  const rows = schema === 'vida'
    ? await sql`
        SELECT 'vida' empresa, m.knumfoli, m.fechanvt::text, m.id_tdocu, m.vendedor,
          m.kcodclie::text kcodclie, c1.nombress, COALESCE(c1.celular,'') celular,
          COALESCE(c1.email01,'') email01, COALESCE(c1.ciudad,'') ciudad,
          CASE WHEN m.kcodcli2 IS NOT NULL AND m.kcodcli2 != m.kcodclie THEN m.kcodcli2::text END kcodcli2,
          CASE WHEN m.kcodcli2 IS NOT NULL AND m.kcodcli2 != m.kcodclie THEN c2.nombress END factura_nombre,
          (SELECT json_agg(json_build_object('descrip',i.descrip,'precdocd',i.precdocd,
             'codigo',i.codigo,'tcancaja',i.tcancaja,'cantxcaja',i.cantxcaja,
             'precread',i.precread,'totaldoc',i.totaldoc))
           FROM (
             SELECT DISTINCT ON (descrip, precdocd)
               descrip, precdocd, codigo, tcancaja, cantxcaja, precread, totaldoc
             FROM vida.itemdcto
             WHERE knumfoli=m.knumfoli
             ORDER BY descrip, precdocd
           ) i) items,
          s.id seg_id, s.prioridad, s.estado, s.asignado_a, s.notas_internas,
          (SELECT MAX(si.created_at)::text FROM public.seguimiento_interacciones si WHERE si.seguimiento_id=s.id) ultima_interaccion,
          (SELECT si.proximo_contacto::text FROM public.seguimiento_interacciones si WHERE si.seguimiento_id=s.id ORDER BY si.created_at DESC LIMIT 1) proximo_contacto
        FROM vida.movidcto m
        JOIN vida.clientes c1 ON c1.kcodclie=m.kcodclie
        LEFT JOIN vida.clientes c2 ON m.kcodcli2 IS NOT NULL AND m.kcodcli2!=m.kcodclie AND c2.kcodclie=m.kcodcli2
        LEFT JOIN public.seguimientos s ON s.empresa='vida' AND s.knumfoli=m.knumfoli
        WHERE m.pestadot='1' AND m.id_tdocu IN ('203','551','554')
          AND (m.visaadua IS NULL OR TRIM(m.visaadua)='')
          AND (${vendedor}::text IS NULL OR m.vendedor=${vendedor})
          AND (${knumfoli}::text IS NULL OR m.knumfoli=${knumfoli})
          AND (${mes}::integer IS NULL OR EXTRACT(MONTH FROM m.fechanvt) = ${mes})
          AND (${anio}::integer IS NULL OR EXTRACT(YEAR FROM m.fechanvt) = ${anio})`
    : await sql`
        SELECT 'sanjh' empresa, m.knumfoli, m.fechanvt::text, m.id_tdocu, m.vendedor,
          m.kcodclie::text kcodclie, c1.nombress, COALESCE(c1.celular,'') celular,
          COALESCE(c1.email01,'') email01, COALESCE(c1.ciudad,'') ciudad,
          CASE WHEN m.kcodcli2 IS NOT NULL AND m.kcodcli2 != m.kcodclie THEN m.kcodcli2::text END kcodcli2,
          CASE WHEN m.kcodcli2 IS NOT NULL AND m.kcodcli2 != m.kcodclie THEN c2.nombress END factura_nombre,
          (SELECT json_agg(json_build_object('descrip',i.descrip,'precdocd',i.precdocd,
             'codigo',i.codigo,'tcancaja',i.tcancaja,'cantxcaja',i.cantxcaja,
             'precread',i.precread,'totaldoc',i.totaldoc))
           FROM (
             SELECT DISTINCT ON (descrip, precdocd)
               descrip, precdocd, codigo, tcancaja, cantxcaja, precread, totaldoc
             FROM sanjh.itemdcto
             WHERE knumfoli=m.knumfoli
             ORDER BY descrip, precdocd
           ) i) items,
          s.id seg_id, s.prioridad, s.estado, s.asignado_a, s.notas_internas,
          (SELECT MAX(si.created_at)::text FROM public.seguimiento_interacciones si WHERE si.seguimiento_id=s.id) ultima_interaccion,
          (SELECT si.proximo_contacto::text FROM public.seguimiento_interacciones si WHERE si.seguimiento_id=s.id ORDER BY si.created_at DESC LIMIT 1) proximo_contacto
        FROM sanjh.movidcto m
        JOIN sanjh.clientes c1 ON c1.kcodclie=m.kcodclie
        LEFT JOIN sanjh.clientes c2 ON m.kcodcli2 IS NOT NULL AND m.kcodcli2!=m.kcodclie AND c2.kcodclie=m.kcodcli2
        LEFT JOIN public.seguimientos s ON s.empresa='sanjh' AND s.knumfoli=m.knumfoli
        WHERE m.pestadot='1' AND m.id_tdocu IN ('203','551','554')
          AND (m.visaadua IS NULL OR TRIM(m.visaadua)='')
          AND (${vendedor}::text IS NULL OR m.vendedor=${vendedor})
          AND (${knumfoli}::text IS NULL OR m.knumfoli=${knumfoli})
          AND (${mes}::integer IS NULL OR EXTRACT(MONTH FROM m.fechanvt) = ${mes})
          AND (${anio}::integer IS NULL OR EXTRACT(YEAR FROM m.fechanvt) = ${anio})`;
  return fmt(rows as any[]);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;
  const rol = (session!.user as any).rol;
  const nombre = (session!.user as any).nombre as string;
  const { searchParams } = new URL(request.url);
  const empresa = searchParams.get('empresa') ?? 'ambas';
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Number(searchParams.get('offset') ?? 0);
  const vendedorFiltro = searchParams.get('vendedor') ?? null;
  const knumfoliFiltro = searchParams.get('knumfoli') ?? null;
  const mesFiltro  = searchParams.get('mes')  ? parseInt(searchParams.get('mes')!)  : null;
  const anioFiltro = searchParams.get('anio') ? parseInt(searchParams.get('anio')!) : null;
  try {
    let data: any[] = [];
    if (empresa === 'vida' || empresa === 'ambas') data.push(...await queryNotas('vida', vendedorFiltro, knumfoliFiltro, mesFiltro, anioFiltro));
    if (empresa === 'sanjh' || empresa === 'ambas') data.push(...await queryNotas('sanjh', vendedorFiltro, knumfoliFiltro, mesFiltro, anioFiltro));
    data.sort((a, b) => a.fechanvt.localeCompare(b.fechanvt));
    return NextResponse.json({ data: data.slice(offset, offset + limit), total: data.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const g = guard(session);
  if (g) return g;
  try {
    const { empresa, knumfoli, prioridad, asignado_a, notas_internas } = await request.json();
    if (!empresa || !knumfoli) return NextResponse.json({ error: 'empresa y knumfoli requeridos' }, { status: 400 });
    if (!['vida', 'sanjh'].includes(empresa)) return NextResponse.json({ error: 'empresa inválida' }, { status: 400 });
    const created_by = parseInt((session!.user as any).id, 10);
    const [row] = await sql`
      INSERT INTO public.seguimientos (empresa, knumfoli, prioridad, asignado_a, notas_internas, created_by)
      VALUES (${empresa}, ${knumfoli}, ${prioridad ?? 'normal'}, ${asignado_a ?? null}, ${notas_internas ?? null}, ${created_by})
      ON CONFLICT (empresa, knumfoli) DO UPDATE
        SET prioridad=EXCLUDED.prioridad, asignado_a=EXCLUDED.asignado_a,
            notas_internas=EXCLUDED.notas_internas, updated_at=now()
      RETURNING id, empresa, knumfoli`;
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
