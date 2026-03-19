import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubirImagenesClient } from "./client_page";

export default async function SubirImagenesPage() {
  const session = await getServerSession(authOptions);

  if (!session || !['admin', 'supervisor'].includes((session.user as any).rol)) {
    redirect('/dashboard');
  }

  return <SubirImagenesClient />;
}
