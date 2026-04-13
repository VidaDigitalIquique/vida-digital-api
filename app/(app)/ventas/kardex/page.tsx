import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { KardexClientePage } from "./client_page";

export default async function KardexPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const empresas = await sql`SELECT id, slug FROM empresas`;
  const empresasMap: Record<number, string> = {};
  empresas.forEach((e) => {
    empresasMap[e.id] = e.slug;
  });

  return (
    <KardexClientePage
      session={session.user as any}
      empresasMap={empresasMap}
    />
  );
}
