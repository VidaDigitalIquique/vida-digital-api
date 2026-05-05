import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SueldosClient } from "./client_page";

export default async function SueldosPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin") {
    redirect("/dashboard");
  }
  return <SueldosClient />;
}
