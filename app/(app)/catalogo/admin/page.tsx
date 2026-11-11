import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { puedeGestionarCatalogos } from "@/lib/roles";
import { CatalogoAdminClient } from "./client_page";

export default async function CatalogoAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!puedeGestionarCatalogos((session.user as any).rol)) redirect("/dashboard");

  return <CatalogoAdminClient session={session} />;
}
