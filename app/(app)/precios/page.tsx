import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PreciosClient } from "./client_page";

export default async function PreciosPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  // We need the slugs for Cloudinary image paths based on ID
  const empresas = await sql`SELECT id, slug FROM empresas`;
  const empresasMap: Record<number, string> = {};
  empresas.forEach(e => {
    empresasMap[e.id] = e.slug;
  });

  // Client will figure out the activeEmpresaId
  // we just render the shell here
  return (
    <PreciosClient 
      session={session as any} 
      empresasMap={empresasMap} 
    />
  );
}
