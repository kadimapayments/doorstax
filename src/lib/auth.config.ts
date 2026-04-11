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
        token.mustChangePassword = user.mustChangePassword ?? false;
        token.onboardingComplete = user.onboardingComplete ?? true;
        token.sessionStartedAt = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword ?? false;
      session.user.onboardingComplete = token.onboardingComplete ?? true;
      session.user.sessionStartedAt = token.sessionStartedAt;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 28800, // 8 hours — absolute session lifetime
    updateAge: 3600, // Refresh JWT at most once per hour
  },
} satisfies NextAuthConfig;
