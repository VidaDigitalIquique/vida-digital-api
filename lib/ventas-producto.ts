import { sql } from "@/lib/db";

export type EmpresaVentas = "vida" | "sanjh";

export interface VentaProducto {
  fecha: string; // 'YYYY-MM-DD' (to_char, sin conversion de zona)
  nota: string;
  cliente: string | null;
  vendedor: string | null;
  cajas: number;
  unidades: number;
  precio: number;
}

/** Whitelist de esquemas: nunca se interpola el texto del usuario en SQL. */
export function schemaDeEmpresa(empresaSlug: string | null): EmpresaVentas | null {
  if (empresaSlug === "sanjh") return "sanjh";
  if (empresaSlug === "vida" || empresaSlug === "vidadigital") return "vida";
  return null;
}

type PatronRow = { patron_nombre: string };

type VentaRow = {
  precio: unknown;
  cajas: unknown;
  unidades: unknown;
  cliente: string | null;
  vendedor: string | null;
  nota: unknown;
  fecha: string | null;
};

/**
 * Unica fuente de verdad de "ventas registradas": el conteo de /api/kardex y las
 * filas del detalle salen de aqui, asi no pueden divergir.
 */
export async function ventasDeProducto(
  schema: EmpresaVentas,
  codigo: string
): Promise<{ ventas: VentaProducto[]; patronesExcluidos: number }> {
  const exclusiones = schema === "sanjh"
    ? await sql`SELECT patron_nombre FROM kardex_clientes_excluidos WHERE empresa_id = 1 AND activo = true`
    : await sql`SELECT patron_nombre FROM kardex_clientes_excluidos WHERE empresa_id = 2 AND activo = true`;
  const patrones = (exclusiones as PatronRow[]).map(e => e.patron_nombre);

  const filas = schema === "sanjh"
    ? await sql`
        SELECT i.precread AS precio,
               i.tcancaja AS cajas,
               i.cantsali AS unidades,
               m.cliente,
               m.vendedor,
               m.knumfoli AS nota,
               to_char(m.fechanvt, 'YYYY-MM-DD') AS fecha
        FROM sanjh.itemdcto i
        INNER JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
        WHERE m.tipomovi = 'V'
          AND i.precread > 0
          AND i.cantsali > 0
          AND i.codunico = ${codigo}
      `
    : await sql`
        SELECT i.precread AS precio,
               i.tcancaja AS cajas,
               i.cantsali AS unidades,
               m.cliente,
               m.vendedor,
               m.knumfoli AS nota,
               to_char(m.fechanvt, 'YYYY-MM-DD') AS fecha
        FROM vida.itemdcto i
        INNER JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
        WHERE m.tipomovi = 'V'
          AND i.precread > 0
          AND i.cantsali > 0
          AND i.codunico = ${codigo}
      `;

  const ventas: VentaProducto[] = (filas as VentaRow[])
    .filter(r => !patrones.some(p => r.cliente?.toUpperCase().includes(p.toUpperCase())))
    .map(r => ({
      fecha: String(r.fecha ?? ""),
      nota: String(r.nota ?? ""),
      cliente: r.cliente ?? null,
      vendedor: r.vendedor ?? null,
      cajas: Number(r.cajas) || 0,
      unidades: Number(r.unidades) || 0,
      precio: Number(r.precio),
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.nota.localeCompare(a.nota));

  return { ventas, patronesExcluidos: patrones.length };
}
