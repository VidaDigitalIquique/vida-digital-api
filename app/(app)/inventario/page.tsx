import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InventarioClient } from "./client_page";

export default async function InventarioPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  return (
    <InventarioClient />
  );
}
