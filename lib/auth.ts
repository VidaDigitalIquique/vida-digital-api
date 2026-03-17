import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { sql } from './db';
import { Usuario } from '@/types';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        rut: { label: "RUT", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.rut || !credentials?.password) return null;

        try {
          // Normalize RUT to exact DB format matching
          const cleanRut = credentials.rut.trim();
          
          const users = await sql`
            SELECT id, rut, nombre, rol, password, activo 
            FROM usuarios 
            WHERE rut = ${cleanRut} AND activo = true
          `;

          const user = users[0] as Usuario;
          if (!user || !user.password) return null;

          const isPasswordValid = await compare(credentials.password, user.password);
          if (!isPasswordValid) return null;

          // Fetch associated companies
          const userEmpresas = await sql`
            SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ${user.id}
          `;
          const empresas = userEmpresas.map(row => row.empresa_id);

          return {
            id: String(user.id),
            rut: user.rut,
            nombre: user.nombre,
            rol: user.rol,
            empresas
          };
        } catch (error) {
          console.error("Auth Exception:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rut = (user as any).rut;
        token.nombre = (user as any).nombre;
        token.rol = (user as any).rol;
        token.empresas = (user as any).empresas;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).rut = token.rut;
        (session.user as any).nombre = token.nombre;
        (session.user as any).rol = token.rol;
        (session.user as any).empresas = token.empresas || [];
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 Days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
