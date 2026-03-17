import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { BodegaClient } from "./client_page";

export default async function BodegaPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const empresas = await sql`SELECT id, slug FROM empresas`;
  const empresasMap: Record<number, string> = {};
  empresas.forEach(e => {
    empresasMap[e.id] = e.slug;
  });

  return (
    <BodegaClient 
      session={session as any} 
      activeEmpresaId={0} 
      empresasMap={empresasMap} 
    />
  );
}
