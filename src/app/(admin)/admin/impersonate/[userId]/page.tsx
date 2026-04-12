import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createImpersonationSession,
} from "@/lib/impersonation-session";
import { auditLog } from "@/lib/audit";

/**
 * Visiting /admin/impersonate/[userId] starts impersonation and
 * redirects to /dashboard. This uses the existing impersonation
 * system (cookie + token) so the full PM dashboard loads natively.
 */
export default async function ImpersonateRedirect({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const { userId } = await params;

  const landlord = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!landlord) redirect("/admin/merchants");

  // Create impersonation session + set cookies
  const token = await createImpersonationSession({
    adminId: session.user.id,
    targetUserId: landlord.id,
    targetRole: "PM",
  });

  const cookieStore = await cookies();
  cookieStore.set("impersonation_token", token, {
    path: "/",
    httpOnly: true,
    maxAge: 3600,
    sameSite: "strict",
  });
  cookieStore.set(
    "impersonation_meta",
    JSON.stringify({ type: "landlord", targetName: landlord.name }),
    { path: "/", httpOnly: false, maxAge: 3600, sameSite: "strict" }
  );
  cookieStore.set(
    "impersonating",
    JSON.stringify({
      type: "landlord",
      landlordId: landlord.id,
      landlordName: landlord.name,
      adminId: session.user.id,
      adminName: session.user.name,
    }),
    { path: "/", httpOnly: true, maxAge: 3600, sameSite: "strict" }
  );

  auditLog({
    userId: session.user.id,
    userName: session.user.name || null,
    userRole: session.user.role,
    action: "IMPERSONATE",
    objectType: "User",
    objectId: landlord.id,
    description: `Admin started impersonating PM ${landlord.name}`,
  });

  redirect("/dashboard");
}
