import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: Role) {
  const user = await requireAuth();
  if (user.role !== role) redirect("/login");
  return user;
}

export async function requireAnyRole(...roles: Role[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect("/login");
  return user;
}
