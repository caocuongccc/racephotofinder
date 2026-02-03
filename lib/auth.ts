import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET!, // 👈 BẮT BUỘC TRONG NEXT.JS 16

  session: {
    strategy: "jwt",
  },

  jwt: {
    encryption: false, // 👈 BẮT BUỘC TRONG NEXT.JS 16
    maxAge: 60 * 60 * 24 * 30,
  },

  adapter: PrismaAdapter(prisma),

  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email và mật khẩu là bắt buộc");
        }
        console.log("Attempting to authorize user:", credentials);
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        console.log("passwordHash found:", user.passwordHash);
        console.log("User found:", user);
        if (!user || !user.passwordHash) {
          throw new Error("Email hoặc mật khẩu không đúng");
        }

        if (!user.isActive) {
          throw new Error("Tài khoản đã bị khóa");
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.passwordHash,
        );

        if (!isPasswordValid) {
          throw new Error("Email hoặc mật khẩu không đúng");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
  }

  interface Session {
    user: User & {
      id: string;
      role: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
