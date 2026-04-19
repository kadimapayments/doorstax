import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { auditLog } from "@/lib/audit";
import {
  createImpersonationSession,
  revokeImpersonationSessions,
} from "@/lib/impersonation-session";

// POST: start impersonating
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tenantId, landlordId } = body;
  const cookieStore = await cookies();

  // Helper: set all impersonation cookies (token, meta, and legacy for layouts/banner)
  function setImpersonationCookies(
    token: string,
    meta: Record<string, string | undefined>,
    legacyData: Record<string, string | undefined>
  ) {
    cookieStore.set("impersonation_token", token, {
      path: "/",
      httpOnly: true,
      maxAge: 3600,
      sameSite: "strict",
    });
    cookieStore.set("impersonation_meta", JSON.stringify(meta), {
      path: "/",
      httpOnly: false,
      maxAge: 3600,
      sameSite: "strict",
    });
    // Legacy cookie — used by layouts for banner display
    cookieStore.set("impersonating", JSON.stringify(legacyData), {
      path: "/",
      httpOnly: true,
      maxAge: 3600,
      sameSite: "strict",
    });
  }

  // ── ADMIN impersonation ──
  if (session.user.role === "ADMIN") {
    if (landlordId) {
      // Allow impersonating any PM, LANDLORD, or ADMIN user. The ADMIN case
      // covers founders who were promoted from PM → ADMIN but still hold an
      // approved MerchantApplication they want to test transactions against
      // (self-impersonation). TENANT/VENDOR/OWNER/PARTNER targets are routed
      // through the tenantId path below or rejected.
      const landlord = await db.user.findUnique({
        where: { id: landlordId },
        select: { id: true, name: true, role: true },
      });
      if (
        !landlord ||
        !["PM", "LANDLORD", "ADMIN"].includes(landlord.role)
      ) {
        return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
      }

      const token = await createImpersonationSession({
        adminId: session.user.id,
        targetUserId: landlord.id,
        targetRole: "PM",
      });

      setImpersonationCookies(
        token,
        { type: "landlord", targetName: landlord.name },
        {
          type: "landlord",
          landlordId: landlord.id,
          landlordName: landlord.name,
          adminId: session.user.id,
          adminName: session.user.name,
        }
      );

      auditLog({
        userId: session.user.id,
        userName: session.user.name,
        userRole: session.user.role,
        action: "IMPERSONATE",
        objectType: "User",
        objectId: landlord.id,
        description: `Admin started impersonating landlord ${landlord.name}`,
        req,
      });

      return NextResponse.json({ success: true, landlordName: landlord.name });
    }

    if (tenantId) {
      const tenant = await db.tenantProfile.findFirst({
        where: { id: tenantId },
        include: { user: { select: { id: true, name: true } } },
      });
      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }

      const token = await createImpersonationSession({
        adminId: session.user.id,
        targetUserId: tenant.userId,
        targetRole: "TENANT",
      });

      setImpersonationCookies(
        token,
        { type: "tenant", targetName: tenant.user.name },
        {
          type: "tenant",
          tenantUserId: tenant.userId,
          tenantName: tenant.user.name,
          adminId: session.user.id,
          adminName: session.user.name,
        }
      );

      auditLog({
        userId: session.user.id,
        userName: session.user.name,
        userRole: session.user.role,
        action: "IMPERSONATE",
        objectType: "User",
        objectId: tenant.userId,
        description: `Admin started impersonating tenant ${tenant.user.name}`,
        req,
      });

      return NextResponse.json({ success: true, tenantName: tenant.user.name });
    }

    return NextResponse.json({ error: "landlordId or tenantId required" }, { status: 400 });
  }

  // ── LANDLORD impersonation ──
  if (session.user.role === "PM") {
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    const tenant = await db.tenantProfile.findFirst({
      where: {
        id: tenantId,
        unit: { property: { landlordId: session.user.id } },
      },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const token = await createImpersonationSession({
      adminId: session.user.id,
      targetUserId: tenant.userId,
      targetRole: "TENANT",
    });

    setImpersonationCookies(
      token,
      { type: "tenant", targetName: tenant.user.name },
      {
        type: "tenant",
        tenantUserId: tenant.userId,
        tenantName: tenant.user.name,
        landlordId: session.user.id,
        landlordName: session.user.name,
      }
    );

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "IMPERSONATE",
      objectType: "User",
      objectId: tenant.userId,
      description: `PM started impersonating tenant ${tenant.user.name}`,
      req,
    });

    return NextResponse.json({ success: true, tenantName: tenant.user.name });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// DELETE: stop impersonating
export async function DELETE() {
  const session = await auth();
  if (session?.user) {
    await revokeImpersonationSessions(session.user.id);
  }

  const cookieStore = await cookies();
  cookieStore.delete("impersonation_token");
  cookieStore.delete("impersonation_meta");
  cookieStore.delete("impersonating"); // Clean up legacy cookie
  return NextResponse.json({ success: true });
}
