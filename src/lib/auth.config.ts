import type { NextAuthConfig } from "next-auth";

/**
 * Shared auth config — no Prisma, no bcrypt, safe for Edge middleware.
 * Callbacks that access `user.role` live here too since middleware needs them
 * to populate req.auth.
 */
export const authConfig = {
  providers: [],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
} satisfies NextAuthConfig;
