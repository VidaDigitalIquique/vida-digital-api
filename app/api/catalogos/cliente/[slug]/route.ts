import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;

  try {
    const cats = await sql`
      SELECT c.*, e.slug as empresa_slug
      FROM catalogos c
      JOIN empresas e ON c.empresa_id = e.id
      WHERE c.slug = ${slug} AND c.activo = true AND c.kcodclie IS NOT NULL
    `;
    if (cats.length === 0) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });
    const cat = cats[0];

    const [comprasSanjh, comprasVida] = await Promise.all([
      sql`
        SELECT i.codunico as codigo, i.precread as precio
        FROM sanjh.itemdcto i
        INNER JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
        WHERE m.tipomovi = 'V'
          AND m.kcodcli2 = ${cat.kcodclie}
          AND i.precread > 0
          AND i.cantsali > 0
      `,
      sql`
        SELECT i.codunico as codigo, i.precread as precio
        FROM vida.itemdcto i
        INNER JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
        WHERE m.tipomovi = 'V'
          AND m.kcodcli2 = ${cat.kcodclie}
          AND i.precread > 0
          AND i.cantsali > 0
      `,
    ]);

    const todasLasCompras = [...comprasSanjh, ...comprasVida];

    // Agrupar precios por código
    const preciosPorCodigo: Record<string, number[]> = {};
    for (const row of todasLasCompras) {
      if (!preciosPorCodigo[row.codigo]) preciosPorCodigo[row.codigo] = [];
      preciosPorCodigo[row.codigo].push(Number(row.precio));
    }

    const codigosUnicos = Object.keys(preciosPorCodigo);
    if (codigosUnicos.length === 0) return NextResponse.json({ data: { titulo: cat.titulo, descripcion: cat.descripcion, mostrar_precio: cat.mostrar_precio, empresa_slug: cat.empresa_slug, kcodclie: cat.kcodclie, productos: [] } });

    let productos = await sql`
      SELECT codigo,
             MAX(detalle)    as detalle,
             MAX(imagen_url) as imagen_url,
             MAX(cantcaja)   as cantcaja,
             MAX(umed)       as umed,
             MAX(costo)      as costo,
             SUM(saldo)      as saldo
      FROM public.productos
      WHERE codigo = ANY(${codigosUnicos})
      GROUP BY codigo
    `;

    if (cat.solo_stock) {
      productos = productos.filter((p: any) => Number(p.saldo) > 0);
    }

    const margen = Number(cat.margen_precio ?? 0);

    const productosConPrecio = productos.map((p: any) => {
      const precios = preciosPorCodigo[p.codigo] ?? [];
      let precio_catalogo: number | null = null;

      if (cat.mostrar_precio && precios.length > 0) {
        switch (cat.tipo_precio) {
          case 'max':
            precio_catalogo = Math.max(...precios);
            break;
          case 'min':
            precio_catalogo = Math.min(...precios);
            break;
          case 'ultimo':
            precio_catalogo = precios[precios.length - 1];
            break;
          case 'costo_mas_margen':
            precio_catalogo = Math.ceil(Number(p.costo) * (1 + margen / 100) * 10) / 10;
            break;
          case 'sin_precio':
          default:
            precio_catalogo = null;
        }
      }

      return {
        codigo: p.codigo,
        detalle: p.detalle,
        imagen_url: p.imagen_url,
        cantcaja: p.cantcaja,
        umed: p.umed,
        saldo: Number(p.saldo),
        precio_catalogo,
      };
    });

    return NextResponse.json({
      data: {
        titulo: cat.titulo,
        descripcion: cat.descripcion,
        mostrar_precio: cat.mostrar_precio,
        empresa_slug: cat.empresa_slug,
        kcodclie: cat.kcodclie,
        productos: productosConPrecio,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
