import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";
import { auditLog } from "@/lib/audit";

declare module "next-auth" {
  interface User {
    role: Role;
    mustChangePassword?: boolean;
    onboardingComplete?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      mustChangePassword?: boolean;
      onboardingComplete?: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    mustChangePassword?: boolean;
    onboardingComplete?: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        let isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        // Fallback: check temp password if normal password fails
        if (!isValid && user.tempPasswordHash) {
          isValid = await compare(
            credentials.password as string,
            user.tempPasswordHash
          );
        }

        if (!isValid) return null;

        // ── 2FA verification ──
        if (user.twoFactorEnabled) {
          const code = credentials.twoFactorCode as string | undefined;
          if (!code || !user.twoFactorCode || !user.twoFactorCodeExp) {
            return null;
          }
          if (new Date() > user.twoFactorCodeExp) return null;

          const hashedInput = createHash("sha256").update(code).digest("hex");
          if (hashedInput !== user.twoFactorCode) return null;

          // Clear the used code
          await db.user.update({
            where: { id: user.id },
            data: { twoFactorCode: null, twoFactorCodeExp: null },
          });
        }

        auditLog({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN",
          objectType: "User",
          objectId: user.id,
          description: `User logged in (${user.email})`,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          onboardingComplete: user.onboardingComplete,
        };
      },
    }),
  ],
});
