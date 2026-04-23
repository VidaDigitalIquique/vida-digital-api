import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

type RouteContext = {
  params: {
    id: string;
  };
};

type CompradorRow = {
  kcodclie: number;
  nombre: string;
  celular: string | null;
  pais: string | null;
  ciudad: string | null;
  estrellas: number;
  compras: Array<{
    fecha: string;
    nvta: string;
    cantidad: number;
    precio: number;
    empresa_id: number;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (rol === 'bodeguero') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const codigo = params.id;

  const rows = await sql`
    SELECT
      m.kcodcli2 AS kcodclie,
      c.nombress AS nombre,
      c.celular,
      c.pais,
      c.ciudad,
      COALESCE(cr.estrellas, 0) AS estrellas,
      m.fechanvt::text AS fecha,
      m.knumfoli AS nvta,
      i.cantsali AS cantidad,
      i.precread AS precio,
      2 AS empresa_id
    FROM vida.itemdcto i
    JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
    JOIN vida.clientes c ON c.kcodclie = m.kcodcli2
    LEFT JOIN public.cliente_ratings cr ON cr.kcodclie = m.kcodcli2
    WHERE i.codunico = ${codigo}
      AND m.tipomovi = 'V'
      AND i.cantsali > 0
      AND m.kcodcli2 IS NOT NULL
    UNION ALL
    SELECT
      m.kcodcli2,
      c.nombress,
      c.celular,
      c.pais,
      c.ciudad,
      COALESCE(cr.estrellas, 0),
      m.fechanvt::text,
      m.knumfoli,
      i.cantsali,
      i.precread,
      1
    FROM sanjh.itemdcto i
    JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
    JOIN sanjh.clientes c ON c.kcodclie = m.kcodcli2
    LEFT JOIN public.cliente_ratings cr ON cr.kcodclie = m.kcodcli2
    WHERE i.codunico = ${codigo}
      AND m.tipomovi = 'V'
      AND i.cantsali > 0
      AND m.kcodcli2 IS NOT NULL
    ORDER BY fecha DESC
  `;

  const map = new Map<number, CompradorRow>();
  for (const row of rows as any[]) {
    const key = Number(row.kcodclie);
    if (!map.has(key)) {
      map.set(key, {
        kcodclie: key,
        nombre: row.nombre,
        celular: row.celular,
        pais: row.pais,
        ciudad: row.ciudad,
        estrellas: Number(row.estrellas),
        compras: [],
      });
    }
    map.get(key)!.compras.push({
      fecha: row.fecha,
      nvta: row.nvta,
      cantidad: Number(row.cantidad),
      precio: Number(row.precio),
      empresa_id: Number(row.empresa_id),
    });
  }

  return NextResponse.json({ data: Array.from(map.values()) });
}
