import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        await connectToDatabase();
        const user = await User.findOne({ email: credentials.email }).lean();
        if (!user) {
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) {
          return null;
        }

        return {
          id: user._id.toString(),
          name: user.fullName,
          email: user.email,
          role: user.globalRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as string) ?? "Collaborator";
      }
      return session;
    },
  },
  pages: {
    signIn: "/uk/login",
  },
};
