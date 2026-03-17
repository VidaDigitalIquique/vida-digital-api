import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { UsuariosClient } from "./client_page";
import { redirect } from "next/navigation";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  
  // Strict role guard for SSR
  if (!session || (session.user as any).rol !== 'admin') {
    redirect('/dashboard');
  }

  // Fetch empresas to pass mapping easily to client
  const empresasDesc = await sql`SELECT id, nombre FROM empresas ORDER BY id ASC`;

  // Build simple array map
  const catalogList = empresasDesc.map(e => ({ id: e.id, nombre: e.nombre }));

  return (
     <UsuariosClient 
       empresasList={catalogList} 
       currentUserId={(session.user as any).id}
     />
  );
}
