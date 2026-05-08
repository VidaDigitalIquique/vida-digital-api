import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SeguimientosClient } from "./SeguimientosClient";

export default async function SeguimientosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") redirect("/dashboard");
  return <SeguimientosClient isAdmin={rol === "admin"} />;
}
