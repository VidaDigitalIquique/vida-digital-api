import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('empresa');
  const search = searchParams.get('search')?.toLowerCase() || '';
  const soloStock = searchParams.get('soloStock') === 'true';
  const soloNuevo = searchParams.get('soloNuevo') === 'true';

  if (!empresaId) return NextResponse.json({ error: "Falta empresa_id" }, { status: 400 });

  if (!(session.user as any).empresas.includes(parseInt(empresaId, 10))) {
    return NextResponse.json({ error: "Empresa no autorizada" }, { status: 403 });
  }

  try {
    const eid = parseInt(empresaId, 10);

    // Use branch logic to avoid dynamic sql() calls which Neon doesn't support
    let rows;

    // Aggregated query to show total stock per product code
    const baseQuery = `
      SELECT 
        codigo, 
        MAX(id) as id,
        MAX(detalle) as detalle, 
        SUM(saldo) as saldo, 
        MAX(prcventa) as prcventa, 
        MAX(prcminimo) as prcminimo, 
        MAX(costo) as costo, 
        MAX(cif) as cif,
        MAX(umed) as umed,
        MAX(imagen_url) as imagen_url,
        MAX(es_nuevo) as es_nuevo
      FROM productos 
      WHERE empresa_id = \${eid}
    `;

    if (search && soloStock && soloNuevo) {
      const sq = '%' + search + '%';
      rows = await (sql as any)(`${baseQuery} AND (LOWER(codigo) LIKE $2 OR LOWER(detalle) LIKE $2) GROUP BY codigo HAVING SUM(saldo) > 0 AND MAX(es_nuevo::int)::bool = true ORDER BY codigo ASC LIMIT 100`, [eid, sq]);
    } else if (search && soloStock) {
      const sq = '%' + search + '%';
      rows = await (sql as any)(`${baseQuery} AND (LOWER(codigo) LIKE $2 OR LOWER(detalle) LIKE $2) GROUP BY codigo HAVING SUM(saldo) > 0 ORDER BY codigo ASC LIMIT 100`, [eid, sq]);
    } else if (search && soloNuevo) {
      const sq = '%' + search + '%';
      rows = await (sql as any)(`${baseQuery} AND (LOWER(codigo) LIKE $2 OR LOWER(detalle) LIKE $2) GROUP BY codigo HAVING MAX(es_nuevo::int)::bool = true ORDER BY codigo ASC LIMIT 100`, [eid, sq]);
    } else if (soloStock && soloNuevo) {
      rows = await (sql as any)(`${baseQuery} GROUP BY codigo HAVING SUM(saldo) > 0 AND MAX(es_nuevo::int)::bool = true ORDER BY codigo ASC LIMIT 100`, [eid]);
    } else if (search) {
      const sq = '%' + search + '%';
      rows = await (sql as any)(`${baseQuery} AND (LOWER(codigo) LIKE $2 OR LOWER(detalle) LIKE $2) GROUP BY codigo ORDER BY codigo ASC LIMIT 100`, [eid, sq]);
    } else if (soloStock) {
      rows = await (sql as any)(`${baseQuery} GROUP BY codigo HAVING SUM(saldo) > 0 ORDER BY codigo ASC LIMIT 100`, [eid]);
    } else if (soloNuevo) {
      rows = await (sql as any)(`${baseQuery} GROUP BY codigo HAVING MAX(es_nuevo::int)::bool = true ORDER BY codigo ASC LIMIT 100`, [eid]);
    } else {
      rows = await (sql as any)(`${baseQuery} GROUP BY codigo ORDER BY codigo ASC LIMIT 100`, [eid]);
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/productos error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
