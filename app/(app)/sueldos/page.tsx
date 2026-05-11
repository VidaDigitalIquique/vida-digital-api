import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SueldosAdminClient } from "./client_page";
import { SueldosUserClient } from "./mis_sueldos_client";

export default async function SueldosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const isAdmin = (session.user as any).rol === "admin";
  return isAdmin ? <SueldosAdminClient /> : <SueldosUserClient />;
}
