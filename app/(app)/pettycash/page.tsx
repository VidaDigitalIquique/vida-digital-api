import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PettycashClient } from "./client_page";

export default async function PettycashPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin") {
    redirect("/dashboard");
  }
  return <PettycashClient />;
}
