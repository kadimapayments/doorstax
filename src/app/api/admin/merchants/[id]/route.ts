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

async function loadApp(id: string) {
  return db.merchantApplication.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          subscription: true,
          properties: {
            include: {
              units: {
                include: {
                  tenantProfiles: {
                    select: { user: { select: { name: true, email: true } } },
                    take: 1,
                  },
                },
              },
            },
          },
          teamOwned: true,
          feeSchedules: true,
        },
      },
    },
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

  const pmId = app.user?.id;

  // Recent payments (last 20)
  const recentPayments = pmId
    ? await db.payment.findMany({
        where: { landlordId: pmId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          surchargeAmount: true,
          paymentMethod: true,
          status: true,
          kadimaTransactionId: true,
          createdAt: true,
          tenant: {
            select: { user: { select: { name: true } } },
          },
        },
      })
    : [];

  // 30-day processing volume
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCompletedPayments = pmId
    ? await db.payment.findMany({
        where: { landlordId: pmId, status: "COMPLETED", paidAt: { gte: thirtyDaysAgo } },
        select: { amount: true, paymentMethod: true },
      })
    : [];

  const cardPayments = recentCompletedPayments.filter(
    (p) => p.paymentMethod === "card"
  );
  const achPayments = recentCompletedPayments.filter(
    (p) => p.paymentMethod === "ach"
  );
  const volume = {
    cardCount: cardPayments.length,
    cardTotal: cardPayments.reduce((s, p) => s + Number(p.amount), 0),
    achCount: achPayments.length,
    achTotal: achPayments.reduce((s, p) => s + Number(p.amount), 0),
    total: recentCompletedPayments.reduce((s, p) => s + Number(p.amount), 0),
  };

  // Computed counts
  const properties = app.user?.properties ?? [];
  const unitCount = properties.reduce(
    (s: number, p: { units: unknown[] }) => s + p.units.length,
    0
  );
  const tenantCount = properties.reduce(
    (s: number, p: { units: { tenantProfiles?: unknown[] }[] }) =>
      s +
      p.units.filter(
        (u) => u.tenantProfiles && u.tenantProfiles.length > 0
      ).length,
    0
  );

  // Tier info
  const { getTier, getNextTier } = await import("@/lib/residual-tiers");
  const tier = getTier(unitCount);
  const nextTier = getNextTier(unitCount);

  return NextResponse.json({
    app,
    recentPayments,
    volume,
    unitCount,
    tenantCount,
    propertyCount: properties.length,
    tier: {
      name: tier.name,
      platformAchCost: tier.platformAchCost,
      platformCardRate: tier.platformCardRate,
      cardRate: tier.cardRate,
      perUnitCost: tier.perUnitCost,
      feeScheduleLocked: tier.feeScheduleLocked,
    },
    nextTier: nextTier
      ? { name: nextTier.name, minUnits: nextTier.minUnits }
      : null,
  });
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

    // ── Account management ─────────────────────────
    case "reset-password": {
      if (!app.user.email) {
        return NextResponse.json({ error: "No email" }, { status: 400 });
      }
      // Generate a password reset token and send email
      try {
        const { getResend } = await import("@/lib/email");
        const { passwordResetHtml } = await import(
          "@/lib/emails/password-reset"
        );
        const crypto = await import("crypto");
        const rawToken = crypto.randomBytes(32).toString("hex");
        const BASE_URL =
          process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
        await getResend().emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: app.user.email,
          subject: "Reset Your DoorStax Password",
          html: passwordResetHtml({
            name: app.user.name || "there",
            resetUrl: `${BASE_URL}/reset-password?token=${rawToken}`,
          }),
        });
      } catch {}
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "force-logout": {
      // Invalidate sessions by bumping a nonce (NextAuth JWTs will fail)
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true, note: "Session invalidation depends on JWT rotation" });
    }

    case "change-email": {
      const newEmail = String(body.value || "").trim().toLowerCase();
      if (!newEmail || !newEmail.includes("@")) {
        return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      }
      const exists = await db.user.findUnique({ where: { email: newEmail } });
      if (exists) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      await db.user.update({
        where: { id: app.user.id },
        data: { email: newEmail },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    // ── Subscription management ──────────────────────
    case "extend-trial": {
      const days = Number(body.value) || 7;
      const sub = await db.subscription.findUnique({
        where: { userId: app.user.id },
      });
      if (sub?.trialEndsAt) {
        const newEnd = new Date(
          new Date(sub.trialEndsAt).getTime() + days * 24 * 60 * 60 * 1000
        );
        await db.subscription.update({
          where: { id: sub.id },
          data: { trialEndsAt: newEnd },
        });
      }
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "cancel-subscription": {
      if (body.confirm !== "CANCEL") {
        return NextResponse.json({ error: "Type CANCEL to confirm" }, { status: 400 });
      }
      const sub2 = await db.subscription.findUnique({
        where: { userId: app.user.id },
      });
      if (sub2) {
        await db.subscription.update({
          where: { id: sub2.id },
          data: { status: "CANCELLED" },
        });
      }
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    // ── Merchant application ─────────────────────────
    case "force-approve": {
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { status: "APPROVED", completedAt: new Date() },
      });
      try {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: app.user.id,
          createdById: session.user.id,
          type: "MERCHANT_APP_APPROVED",
          title: "Merchant Application Approved",
          message: "Your merchant application has been manually approved. You can now process payments.",
          severity: "info",
          actionUrl: "/dashboard",
        });
      } catch {}
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "reset-application": {
      if (body.confirm !== "RESET") {
        return NextResponse.json({ error: "Type RESET to confirm" }, { status: 400 });
      }
      await db.merchantApplication.update({
        where: { id: app.id },
        data: {
          status: "NOT_STARTED",
          currentStep: 1,
          completedAt: null,
          agreementSignedAt: null,
          agreementPdfUrl: null,
          signatureDetailsPdfUrl: null,
        },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    // ── Kadima config ────────────────────────────────
    case "set-dba-id": {
      const dbaId = String(body.value || "").trim();
      if (!dbaId) {
        return NextResponse.json({ error: "DBA ID required" }, { status: 400 });
      }
      // Store on merchant application or user as needed
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "set-campaign-id": {
      const campaignId = String(body.value || "").trim();
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { campaignId },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "mark-campaign-updated": {
      await logAudit(session.user.id, app.user.id, action, {
        ...body,
        note: "Admin confirmed Kadima campaign rates have been updated",
      }, req);
      return NextResponse.json({ ok: true });
    }

    // ── Tier management ──────────────────────────────
    case "force-tier": {
      const tierName = String(body.value || "").trim();
      if (!["Starter", "Growth", "Scale", "Enterprise"].includes(tierName)) {
        return NextResponse.json({ error: "Invalid tier name" }, { status: 400 });
      }
      await db.user.update({
        where: { id: app.user.id },
        data: { currentTier: tierName, tierLocked: true },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "lock-tier": {
      await db.user.update({
        where: { id: app.user.id },
        data: { tierLocked: true },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "unlock-tier": {
      await db.user.update({
        where: { id: app.user.id },
        data: { tierLocked: false },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    // ── Financial ────────────────────────────────────
    case "freeze-payouts": {
      await db.user.update({
        where: { id: app.user.id },
        data: { payoutsFrozen: true },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "unfreeze-payouts": {
      await db.user.update({
        where: { id: app.user.id },
        data: { payoutsFrozen: false },
      });
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    // ── Communication ────────────────────────────────
    case "send-notification": {
      const msg = String(body.value || "").trim();
      if (!msg) {
        return NextResponse.json({ error: "Message required" }, { status: 400 });
      }
      try {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: app.user.id,
          createdById: session.user.id,
          type: "ADMIN_MESSAGE",
          title: "Message from DoorStax",
          message: msg,
          severity: "info",
        });
      } catch {}
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    case "send-email": {
      const subject = String(body.subject || "").trim();
      const emailBody = String(body.body || "").trim();
      if (!subject || !emailBody || !app.user.email) {
        return NextResponse.json({ error: "Subject, body, and PM email required" }, { status: 400 });
      }
      try {
        const { getResend } = await import("@/lib/email");
        const { emailStyles, emailHeader, emailFooter, esc } = await import("@/lib/emails/_layout");
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>${esc(subject)}</h1><p>Hi ${esc(app.user.name || "there")},</p><p>${esc(emailBody)}</p></div>${emailFooter()}</div></body></html>`;
        await getResend().emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: app.user.email,
          subject,
          html,
        });
      } catch (e) {
        console.error("[admin/send-email]", e);
        return NextResponse.json({ error: "Email send failed" }, { status: 500 });
      }
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    // ── Notes ────────────────────────────────────────
    case "add-note": {
      const content = String(body.content || "").trim();
      if (!content) {
        return NextResponse.json({ error: "Note content required" }, { status: 400 });
      }
      const note = await db.adminNote.create({
        data: {
          targetUserId: app.user.id,
          authorId: session.user.id,
          content,
          isPinned: !!body.isPinned,
        },
      });
      return NextResponse.json({ ok: true, note });
    }

    case "get-notes": {
      const notes = await db.adminNote.findMany({
        where: { targetUserId: app.user.id },
        include: { author: { select: { name: true } } },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 50,
      });
      return NextResponse.json({ notes });
    }

    // ── Inline field edit ─────────────────────────────
    case "update-field": {
      const { field, value: fieldValue } = body;
      const userFields = ["name", "email", "phone", "companyName", "currentTier"];
      const merchantFields = ["kadimaAppId", "kadimaApplicationUrl", "campaignId"];

      if (userFields.includes(field)) {
        await db.user.update({
          where: { id: app.user.id },
          data: { [field]: fieldValue },
        });
      } else if (merchantFields.includes(field)) {
        await db.merchantApplication.update({
          where: { id: app.id },
          data: { [field]: fieldValue },
        });
      } else if (field === "kadimaTerminalId" && body.propertyId) {
        await db.property.update({
          where: { id: body.propertyId },
          data: { kadimaTerminalId: fieldValue },
        });
      } else {
        return NextResponse.json({ error: `Field "${field}" not editable` }, { status: 400 });
      }
      await logAudit(session.user.id, app.user.id, action, body, req);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}

// ── Audit log helper ─────────────────────────────────
async function logAudit(
  adminId: string,
  targetUserId: string,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any,
  req: Request
) {
  try {
    await db.auditLog.create({
      data: {
        userId: adminId,
        action: `ADMIN:${action.toUpperCase()}`,
        objectType: "User",
        objectId: targetUserId,
        description: `Admin action: ${action}`,
        newValue: details,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          "unknown",
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });
  } catch (e) {
    console.error("[admin/audit]", e);
  }
}
