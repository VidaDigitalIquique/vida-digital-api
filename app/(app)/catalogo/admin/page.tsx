import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CatalogoAdminClient } from "./client_page";

export default async function CatalogoAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  return <CatalogoAdminClient session={session} />;
}
