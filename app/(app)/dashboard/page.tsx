import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { DashboardClient } from "./client_page";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) return null; // handled by layout guard
  
  // In a real scenario, the active enterprise is driven by a cookie or query param if server rendering is required
  // Wait, layout handles client side activeEmpresaId. For pure server components, we need a way to pass the active empresa_id.
  // We can't read localStorage on the server.
  // Best approach for Server Components here: either we pass searchParams to the page, or we fetch for ALL user enterprises and the client filters.
  // Given Next.js architecture, we can fetch all stats grouped by empresa, and pass it to a Client Component, or just render it.
  
  // Since we don't have cookies yet, let's fetch stats for all companies the user can access and map them.
  const userEmpresas = (session.user as any).empresas as number[];
  
  if (!userEmpresas?.length) {
     return <div>No hay empresas asignadas.</div>;
  }

  // Fetch metrics per enterprise
  const groupedStats: Record<number, any> = {};
  const empresasInfo = await sql`SELECT id, nombre, slug FROM empresas`;

  // Despachos de HOY
  const despachosHoyCount = userEmpresas.length > 0
    ? Number((await sql`
        SELECT COUNT(*)::int as count
        FROM public.despachos_bodega
        WHERE empresa_id = ANY(${userEmpresas})
          AND DATE(created_at) = CURRENT_DATE
      `)[0]?.count ?? 0)
    : 0;

  const despachosHoyList = userEmpresas.length > 0
    ? await sql`
        SELECT id, folio, imagen_url, created_at
        FROM public.despachos_bodega
        WHERE empresa_id = ANY(${userEmpresas})
          AND DATE(created_at) = CURRENT_DATE
        ORDER BY created_at DESC
      `
    : [];

  // Último día con despachos y su conteo
  const ultimoDiaRows = userEmpresas.length > 0
    ? await sql`
        SELECT DATE(created_at) as fecha, COUNT(*)::int as count
        FROM public.despachos_bodega
        WHERE empresa_id = ANY(${userEmpresas})
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) DESC
        LIMIT 2
      `
    : [];

  const ultimoDia = ultimoDiaRows[0] ?? null;
  const penultimoDia = ultimoDiaRows[1] ?? null;

  for (const empId of userEmpresas) {
    const [{ count: totalProds }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId}`;
    const [{ count: inStock }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId} AND saldo > 0`;
    const [{ count: nuevos }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId} AND es_nuevo = true`;
    const [{ count: sinPrecio }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId} AND prcventa = 0 AND saldo > 0`;
    
    const maxDateRows = await sql`SELECT MAX(updated_at) as max_date FROM productos WHERE empresa_id = ${empId}`;
    const lastImport = maxDateRows[0]?.max_date ? new Date(maxDateRows[0].max_date) : null;

    const [{ count: despachosHoy }] = await sql`
      SELECT COUNT(*)::int FROM public.despachos_bodega
      WHERE empresa_id = ${empId} AND DATE(created_at) = CURRENT_DATE
    `;

    groupedStats[empId] = {
      totalProds,
      inStock,
      nuevos,
      sinPrecio,
      lastImport,
      despachosHoy
    };
  }

  const makeStockCompare = async (empresaId: number) => {
    const empresaRow = empresasInfo.find(e => e.id === empresaId);
    const nombre = empresaRow?.nombre || empresaRow?.slug || `Empresa ${empresaId}`;

    const [counts] = await sql`
      WITH producto_saldos AS (
        SELECT
          u.codigo as codigo,
          SUM(p.saldo)::int as saldo_total,
          CASE
            WHEN BOOL_AND(u.fisico IS NULL) THEN NULL
            ELSE SUM(COALESCE(u.fisico, 0))::int
          END as fisico_total
        FROM productos p
        JOIN ubicaciones_bodega u
          ON u.empresa_id = p.empresa_id AND u.codigo = p.codigo
        WHERE p.empresa_id = ${empresaId}
        GROUP BY u.codigo
      )
      SELECT
        COUNT(*) FILTER (WHERE fisico_total IS NOT NULL AND fisico_total > saldo_total)::int as con_sobrante,
        COUNT(*) FILTER (WHERE fisico_total IS NOT NULL AND fisico_total < saldo_total)::int as con_faltante,
        COUNT(*) FILTER (WHERE fisico_total IS NULL)::int as sin_fisico
      FROM producto_saldos
    `;

    const [{ sum: saldoZofriTotal }] = await sql`
      SELECT COALESCE(SUM(saldo), 0)::int as sum
      FROM productos
      WHERE empresa_id = ${empresaId}
    `;

    const [{ sum: fisicoTotal }] = await sql`
      SELECT SUM(fisico)::int as sum
      FROM ubicaciones_bodega
      WHERE empresa_id = ${empresaId} AND fisico IS NOT NULL
    `;

    return {
      empresaId,
      nombre,
      saldoZofriTotal,
      fisicoTotal: fisicoTotal ?? null,
      conSobrante: counts?.con_sobrante ?? 0,
      conFaltante: counts?.con_faltante ?? 0,
      sinFisico: counts?.sin_fisico ?? 0,
      totalConFisico: (counts?.con_sobrante ?? 0) + (counts?.con_faltante ?? 0),
    };
  };

  const stockCompare = await Promise.all(userEmpresas.map(makeStockCompare));

  return (
    <DashboardClient
      stats={groupedStats}
      stockCompare={stockCompare}
      despachosHoyCount={despachosHoyCount}
      ultimoDia={ultimoDia}
      penultimoDia={penultimoDia}
      despachosHoy={despachosHoyList as any}
    />
  );
}
