import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SeguimientoDetalleClient } from "./SeguimientoDetalleClient";

export default async function SeguimientoDetallePage({ params }: { params: { empresa: string; folio: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const rol = (session.user as any).rol;
  if (rol !== "admin" && rol !== "vendedor") redirect("/dashboard");
  return (
    <SeguimientoDetalleClient
      empresa={params.empresa}
      folio={decodeURIComponent(params.folio)}
      isAdmin={rol === "admin"}
    />
  );
}
