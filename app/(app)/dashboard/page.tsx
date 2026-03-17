import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { DashboardClient } from "./client_page";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) return null; // handled by layout guard
  
  const userEmpresas = (session.user as any).empresas as number[];
  
  if (!userEmpresas?.length) {
     return <div>No hay empresas asignadas.</div>;
  }

  // Fetch metrics per enterprise
  const groupedStats: Record<number, any> = {};

  for (const empId of userEmpresas) {
    const [{ count: totalProds }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId}`;
    const [{ count: inStock }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId} AND saldo > 0`;
    const [{ count: nuevos }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId} AND es_nuevo = true`;
    const [{ count: sinPrecio }] = await sql`SELECT COUNT(*)::int FROM productos WHERE empresa_id = ${empId} AND prcventa = 0 AND saldo > 0`;
    
    const maxDateRows = await sql`SELECT MAX(fecha_ingreso) as max_date FROM productos WHERE empresa_id = ${empId}`;
    const lastImport = maxDateRows[0]?.max_date ? new Date(maxDateRows[0].max_date) : null;

    const [{ count: despachosHoy }] = await sql`
      SELECT COUNT(*)::int FROM despachos 
      WHERE empresa_id = ${empId} AND fecha_despacho = CURRENT_DATE
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

  return (
    <DashboardClient stats={groupedStats} />
  );
}
