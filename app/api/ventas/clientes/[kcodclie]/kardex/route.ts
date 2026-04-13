import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

type RouteContext = {
  params: {
    kcodclie: string;
  };
};

type CompraRow = {
  codigo: string;
  detalle: string;
  fecha: string;
  nvta: string;
  cantidad: number;
  precio: number;
};

type SaldoRow = {
  codigo: string;
  imagen_url: string | null;
  saldo_zofri: number | null;
  saldo_bodega: number | null;
  cantcaja: number | null;
};

export async function GET(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (!session || (rol !== 'admin' && rol !== 'vendedor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const empresaSlug = searchParams.get('empresaSlug')?.trim();
  const desde = searchParams.get('desde')?.trim();
  const hasta = searchParams.get('hasta')?.trim();
  const kcodclie = params.kcodclie;

  if (!empresaSlug) {
    return NextResponse.json({ error: 'empresaSlug requerido' }, { status: 400 });
  }

  const schema = empresaSlug === 'sanjh' ? 'sanjh' : 'vida';
  const empresaId = schema === 'sanjh' ? 1 : 2;

  try {
    const clienteRows = schema === 'sanjh'
      ? await sql`
          SELECT
            c.kcodclie,
            c.nombress,
            c.rutclien,
            c.digiveri,
            c.celular,
            c.ciudad,
            c.pais,
            f.foto_url
          FROM sanjh.clientes c
          LEFT JOIN public.clientes_foto f
            ON f.empresa_id = 1 AND f.kcodclie::text = c.kcodclie::text
          WHERE c.kcodclie = ${kcodclie}
          LIMIT 1
        `
      : await sql`
          SELECT
            c.kcodclie,
            c.nombress,
            c.rutclien,
            c.digiveri,
            c.celular,
            c.ciudad,
            c.pais,
            f.foto_url
          FROM vida.clientes c
          LEFT JOIN public.clientes_foto f
            ON f.empresa_id = 2 AND f.kcodclie::text = c.kcodclie::text
          WHERE c.kcodclie = ${kcodclie}
          LIMIT 1
        `;

    const compras = schema === 'sanjh'
      ? await sql`
          SELECT
            i.codunico as codigo,
            i.descrip as detalle,
            m.fechanvt as fecha,
            m.knumfoli as nvta,
            i.cantsali as cantidad,
            i.precread as precio
          FROM sanjh.itemdcto i
          INNER JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
          WHERE m.tipomovi = 'V'
            AND m.kcodclie = ${kcodclie}
            AND i.precread > 0
            AND i.cantsali > 0
            AND (${desde || null} IS NULL OR m.fechanvt >= ${desde || null})
            AND (${hasta || null} IS NULL OR m.fechanvt <= ${hasta || null})
          ORDER BY m.fechanvt DESC
        `
      : await sql`
          SELECT
            i.codunico as codigo,
            i.descrip as detalle,
            m.fechanvt as fecha,
            m.knumfoli as nvta,
            i.cantsali as cantidad,
            i.precread as precio
          FROM vida.itemdcto i
          INNER JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
          WHERE m.tipomovi = 'V'
            AND m.kcodclie = ${kcodclie}
            AND i.precread > 0
            AND i.cantsali > 0
            AND (${desde || null} IS NULL OR m.fechanvt >= ${desde || null})
            AND (${hasta || null} IS NULL OR m.fechanvt <= ${hasta || null})
          ORDER BY m.fechanvt DESC
        `;

    if (compras.length === 0) {
      return NextResponse.json({
        cliente: clienteRows[0] || null,
        productos: [],
      });
    }

    const codigosUnicos = Array.from(new Set(compras.map((compra: CompraRow) => compra.codigo)));

    const saldos = await sql`
      SELECT
        p.codigo,
        p.imagen_url,
        SUM(p.saldo) as saldo_zofri,
        SUM(u.fisico) as saldo_bodega,
        MAX(p.cantcaja) as cantcaja
      FROM public.productos p
      LEFT JOIN public.ubicaciones_bodega u
        ON u.empresa_id = p.empresa_id AND u.codigo = p.codigo
      WHERE p.empresa_id = ${empresaId}
        AND p.codigo = ANY(${codigosUnicos})
      GROUP BY p.codigo, p.imagen_url
    `;

    const saldosMap = new Map(
      (saldos as SaldoRow[]).map((saldo) => [saldo.codigo, saldo])
    );

    const productosMap = new Map<string, any>();

    for (const compra of compras as CompraRow[]) {
      const existente = productosMap.get(compra.codigo);

      if (!existente) {
        productosMap.set(compra.codigo, {
          codigo: compra.codigo,
          detalle: compra.detalle,
          precio_min: Number(compra.precio),
          precio_max: Number(compra.precio),
          precio_ultimo: Number(compra.precio),
          total_unidades: Number(compra.cantidad),
          ultima_compra: compra.fecha,
          compras: [compra],
        });
        continue;
      }

      existente.precio_min = Math.min(existente.precio_min, Number(compra.precio));
      existente.precio_max = Math.max(existente.precio_max, Number(compra.precio));
      existente.total_unidades += Number(compra.cantidad);
      if (new Date(compra.fecha) > new Date(existente.ultima_compra)) {
        existente.ultima_compra = compra.fecha;
        existente.precio_ultimo = Number(compra.precio);
      }
      existente.compras.push(compra);
    }

    const productos = Array.from(productosMap.values()).map((producto) => {
      const saldo = saldosMap.get(producto.codigo);

      return {
        ...producto,
        imagen_url: saldo?.imagen_url ?? null,
        saldo_zofri: saldo?.saldo_zofri ?? null,
        saldo_bodega: saldo?.saldo_bodega ?? null,
        cantcaja: saldo?.cantcaja ?? null,
      };
    });

    return NextResponse.json({
      cliente: clienteRows[0] || null,
      productos,
    });
  } catch (error: any) {
    console.error('GET /api/ventas/clientes/[kcodclie]/kardex error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
