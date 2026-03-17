import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle2, AlertTriangle, Clock, Truck, PlusCircle } from "lucide-react";

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

// Client Component to react to active empresa switcher
import { DashboardClient } from "./client_page";
