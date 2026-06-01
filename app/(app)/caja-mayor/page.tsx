import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { CajaMayorClient } from "./client_page";
import { redirect } from "next/navigation";

export default async function CajaMayorPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Fetch dollar rate for the form
  const configRows = await sql`
    SELECT valor FROM caja_config WHERE clave = 'dolar_dia'
  `;
  const dolarDia = parseFloat(configRows[0]?.valor || "0");

  // Fetch active accounts for the dropdown
  const cuentas = await sql`
    SELECT id, nombre, moneda, activa, orden, created_at::text
    FROM caja_cuentas
    WHERE activa = true
    ORDER BY orden ASC, id ASC
  `;

  return (
    <CajaMayorClient
      dolarDia={dolarDia}
      cuentas={cuentas as any}
      userName={(session.user as any).nombre || (session.user as any).name || ""}
    />
  );
}
