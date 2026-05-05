import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DeudasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Mis Solicitudes</h1>
      <p className="text-zinc-500 mt-2">UI próximamente (SLICE 4b)</p>
    </main>
  );
}
