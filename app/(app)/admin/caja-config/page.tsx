import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { CajaConfigClient } from "./client_page";
import { redirect } from "next/navigation";

export default async function CajaConfigPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).rol !== "admin") {
    redirect("/dashboard");
  }

  // Fetch initial data on server
  const configRows = await sql`
    SELECT clave, valor, updated_at::text, updated_por
    FROM caja_config
    WHERE clave = 'dolar_dia'
  `;
  const config = configRows[0] ?? { clave: "dolar_dia", valor: "0", updated_at: null, updated_por: "system" };

  const cuentas = await sql`
    SELECT id, nombre, moneda, activa, orden, created_at::text
    FROM caja_cuentas
    ORDER BY orden ASC, id ASC
  `;

  const saldosIniciales = await sql`
    SELECT si.id, si.cuenta_id, cc.nombre AS cuenta_nombre, cc.moneda AS cuenta_moneda,
      si.fecha::text, si.saldo, si.observaciones,
      si.created_at::text, si.updated_at::text
    FROM caja_saldos_iniciales si
    JOIN caja_cuentas cc ON cc.id = si.cuenta_id
    ORDER BY cc.orden ASC
  `;

  return (
    <CajaConfigClient
      initialConfig={{
        dolar_dia: parseFloat(config.valor) || 0,
        updated_at: config.updated_at,
        updated_por: config.updated_por,
      }}
      initialCuentas={cuentas as any}
      initialSaldos={saldosIniciales as any}
    />
  );
}
