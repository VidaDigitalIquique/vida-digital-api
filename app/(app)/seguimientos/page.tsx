import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SeguimientosClient } from "./SeguimientosClient";

export default async function SeguimientosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") redirect("/dashboard");
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-zinc-400">Cargando...</div>}>
      <SeguimientosClient />
    </Suspense>
  );
}
