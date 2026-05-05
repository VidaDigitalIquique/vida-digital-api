import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminDeudasPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "admin") redirect("/dashboard");
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Gestión de Deudas</h1>
      <p className="text-zinc-500 mt-2">UI próximamente (SLICE 4c)</p>
    </main>
  );
}
