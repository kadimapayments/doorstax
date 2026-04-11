import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/merchants/[id]
 *   Returns the full merchant application detail for the admin detail view.
 *
 * POST /api/admin/merchants/[id]
 *   Body: { action: "resend-link" | "expire" | "extend" | "activate" |
 *                   "suspend-subscription" | "assign-terminal", ...payload }
 *
 * Note: [id] is the MerchantApplication.id (not the user id).
 */

const merchantInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          amount: true,
        },
      },
      properties: {
        select: {
          id: true,
          name: true,
          address: true,
          kadimaTerminalId: true,
          units: { select: { id: true } },
        },
      },
    },
  },
} as const;

async function loadApp(id: string) {
  return db.merchantApplication.findUnique({
    where: { id },
    include: merchantInclude,
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const app = await loadApp(id);
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Recent payment activity (last 10 completed)
  const recentPayments = app.user
    ? await db.payment.findMany({
        where: { landlordId: app.user.id, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          createdAt: true,
        },
      })
    : [];

  return NextResponse.json({ app, recentPayments });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  const app = await loadApp(id);
  if (!app || !app.user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  switch (action) {
    case "resend-link": {
      if (!app.user.email) {
        return NextResponse.json(
          { error: "PM has no email on file" },
          { status: 400 }
        );
      }

      // Refetch URL if not cached
      let url = app.kadimaApplicationUrl;
      if (!url && app.kadimaAppId) {
        const { getKadimaBoardingUrl } = await import("@/lib/kadima/lead");
        url = await getKadimaBoardingUrl(app.kadimaAppId);
        if (url) {
          await db.merchantApplication.update({
            where: { id: app.id },
            data: { kadimaApplicationUrl: url },
          });
        }
      }
      if (!url) {
        return NextResponse.json(
          { error: "Could not retrieve Kadima application link" },
          { status: 503 }
        );
      }

      const { getResend } = await import("@/lib/email");
      const { merchantApplicationContinueEmail } = await import(
        "@/lib/emails/merchant-application-continue"
      );
      await getResend().emails.send({
        from: "DoorStax <noreply@doorstax.com>",
        to: app.user.email,
        subject: "Continue Your Merchant Application \u2014 DoorStax",
        html: merchantApplicationContinueEmail({
          pmName: app.user.name || "Property Manager",
          companyName:
            app.businessLegalName || app.dba || app.user.companyName || undefined,
          applicationUrl: url,
          isReminder: true,
        }),
      });
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { lastReminderSentAt: new Date() },
      });
      return NextResponse.json({ ok: true, url });
    }

    case "expire": {
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { status: "EXPIRED" },
      });
      try {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: app.user.id,
          createdById: session.user.id,
          type: "MERCHANT_APP_EXPIRED",
          title: "Merchant Application Expired",
          message:
            "Your merchant application was marked expired by an administrator. Please contact support to restart the process.",
          severity: "urgent",
          actionUrl: "/dashboard/settings",
        });
      } catch {}
      return NextResponse.json({ ok: true });
    }

    case "extend": {
      // Extend by 15 days by backdating createdAt forward
      const newCreatedAt = new Date(
        app.createdAt.getTime() + 15 * 24 * 60 * 60 * 1000
      );
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { createdAt: newCreatedAt },
      });
      return NextResponse.json({ ok: true, newCreatedAt });
    }

    case "activate": {
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { status: "APPROVED", completedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    case "suspend-subscription": {
      const sub = await db.subscription.findUnique({
        where: { userId: app.user.id },
      });
      if (sub) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "CANCELLED" },
        });
      }
      return NextResponse.json({ ok: true });
    }

    case "assign-terminal": {
      const propertyId = String(body.propertyId || "");
      const terminalId = String(body.terminalId || "");
      if (!propertyId || !terminalId) {
        return NextResponse.json(
          { error: "propertyId and terminalId required" },
          { status: 400 }
        );
      }
      // Verify property belongs to this PM
      const prop = await db.property.findFirst({
        where: { id: propertyId, landlordId: app.user.id },
        select: { id: true, name: true },
      });
      if (!prop) {
        return NextResponse.json(
          { error: "Property not found for this manager" },
          { status: 404 }
        );
      }
      await db.property.update({
        where: { id: propertyId },
        data: { kadimaTerminalId: terminalId },
      });
      try {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: app.user.id,
          createdById: session.user.id,
          type: "TERMINAL_ASSIGNED",
          title: "Terminal Provisioned",
          message: `Your Kadima terminal for ${prop.name} has been assigned. You can now process payments at this property.`,
          severity: "info",
          actionUrl: `/dashboard/properties/${propertyId}`,
        });
      } catch {}
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
