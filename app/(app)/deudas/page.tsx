import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DeudasAdminClient } from "./admin_client";
import { DeudasUserClient } from "./client_page";

export default async function DeudasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const isAdmin = (session.user as any).rol === "admin";
  return isAdmin ? <DeudasAdminClient /> : <DeudasUserClient />;
}
