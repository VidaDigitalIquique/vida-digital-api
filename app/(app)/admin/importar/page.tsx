import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ImportarClient } from "./client_page";
import { redirect } from "next/navigation";

export default async function ImportarPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !['admin', 'supervisor'].includes((session.user as any).rol)) {
    redirect('/dashboard');
  }

  return <ImportarClient activeEmpresaId={0} />;
}
