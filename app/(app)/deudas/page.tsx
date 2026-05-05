import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DeudasUserClient } from "./client_page";

export default async function DeudasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <DeudasUserClient />;
}
