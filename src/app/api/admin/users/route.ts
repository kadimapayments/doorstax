export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/admin/users
 *
 * Admin-only user creation. Supports six account types:
 *
 *   PM        — property manager / company running rentals
 *   LANDLORD  — single-landlord account (distinct role, same /dashboard UX)
 *   TENANT    — tenant (optionally linked to a unit right away)
 *   VENDOR    — service vendor in the DoorStax directory
 *   OWNER     — property owner / investor (optionally linked to a property)
 *   DEMO      — PM-role account with isDemo flag; bypasses billing + timer
 *
 * PM + LANDLORD + DEMO accept a creation mode:
 *   "credentials"  — temp password generated + emailed now, mustChangePassword=true
 *   "setup-link"   — pre-create user, email a /onboarding/complete?token=… link
 */

const VALID_ROLES = ["PM", "LANDLORD", "TENANT", "VENDOR", "OWNER", "DEMO"] as const;
type CreationRole = typeof VALID_ROLES[number];

function randomPassword(): string {
  // Readable temp password: 12 chars, alphanumeric, no ambiguous glyphs.
  // Users will be forced to change it on first login anyway.
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 12; i++) out += alpha[bytes[i] % alpha.length];
  return out;
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ctx = await getAdminContext(session.user.id);
  if (!canAdmin(ctx, "admin:landlords") && !canAdmin(ctx, "admin:tenants")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    role?: string;
    email?: string;
    name?: string;
    phone?: string;
    companyName?: string;
    mode?: "credentials" | "setup-link";
    isDemo?: boolean;
    unitId?: string;
    propertyId?: string;
  };

  // ─── Validation ────────────────────────────────────
  if (!body.role || !(VALID_ROLES as readonly string[]).includes(body.role)) {
    return NextResponse.json(
      { error: `role must be one of ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }
  const role = body.role as CreationRole;

  const email = body.email?.toLowerCase().trim() || "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  const name = body.name?.trim() || "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  // ─── DEMO — sanitize & route to PM path ────────────
  const isDemo = role === "DEMO" || body.isDemo === true;
  // DEMO is stored as role=PM with isDemo=true (not a distinct enum value).
  const storageRole = role === "DEMO" ? "PM" : role;

  // ─── PM / LANDLORD / DEMO mode ─────────────────────
  if (["PM", "LANDLORD"].includes(storageRole)) {
    const mode: "credentials" | "setup-link" = body.mode || "credentials";

    if (mode === "credentials") {
      // Generate temp password, force change on first login.
      const tempPassword = randomPassword();
      const passwordHash = await hash(tempPassword, 12);

      const user = await db.user.create({
        data: {
          name,
          email,
          phone: body.phone || null,
          companyName: body.companyName || null,
          passwordHash,
          role: storageRole as "PM" | "LANDLORD",
          mustChangePassword: true,
          isDemo,
        },
      });

      await sendCredentialsEmail({
        to: email,
        name,
        tempPassword,
        isDemo,
      });

      auditLog({
        userId: session.user.id,
        userRole: "ADMIN",
        action: "CREATE",
        objectType: "User",
        objectId: user.id,
        description: `Admin created ${storageRole}${isDemo ? " (demo)" : ""} with credentials: ${email}`,
        req,
      });

      return NextResponse.json({ user: { id: user.id, email, role: storageRole, isDemo } }, { status: 201 });
    }

    // setup-link mode
    const user = await db.user.create({
      data: {
        name,
        email,
        phone: body.phone || null,
        companyName: body.companyName || null,
        // No password. Passing empty string still hashes OK; setup page sets it.
        passwordHash: await hash(randomToken(), 12),
        role: storageRole as "PM" | "LANDLORD",
        mustChangePassword: true,
        isDemo,
      },
    });

    const token = randomToken();
    const setup = await db.userSetupToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: session.user.id,
      },
    });

    await sendSetupLinkEmail({
      to: email,
      name,
      token: setup.token,
      isDemo,
    });

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "CREATE",
      objectType: "User",
      objectId: user.id,
      description: `Admin created ${storageRole}${isDemo ? " (demo)" : ""} with setup link: ${email}`,
      req,
    });

    return NextResponse.json(
      {
        user: { id: user.id, email, role: storageRole, isDemo },
        setupLinkSent: true,
      },
      { status: 201 }
    );
  }

  // ─── TENANT ─────────────────────────────────────────
  if (storageRole === "TENANT") {
    const tempPassword = randomPassword();
    const passwordHash = await hash(tempPassword, 12);

    const user = await db.user.create({
      data: {
        name,
        email,
        phone: body.phone || null,
        passwordHash,
        role: "TENANT",
        mustChangePassword: true,
      },
    });

    // If a unit was provided, create a minimal TenantProfile linked to that
    // unit (and by extension, to the unit's landlord). Otherwise just leave
    // the User as-is — a PM can invite them later via the existing flow.
    let profileId: string | null = null;
    if (body.unitId) {
      const unit = await db.unit.findUnique({
        where: { id: body.unitId },
        select: { id: true, propertyId: true },
      });
      if (!unit) {
        return NextResponse.json({ error: "Unit not found" }, { status: 400 });
      }
      const profile = await db.tenantProfile.create({
        data: {
          userId: user.id,
          unitId: unit.id,
        },
      });
      profileId = profile.id;
    }

    await sendCredentialsEmail({
      to: email,
      name,
      tempPassword,
      isDemo: false,
      portalUrl: `${BASE_URL()}/tenant`,
    });

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "CREATE",
      objectType: "User",
      objectId: user.id,
      description: `Admin created TENANT: ${email}${profileId ? ` (unit ${body.unitId})` : ""}`,
      req,
    });

    return NextResponse.json({ user: { id: user.id, email, role: "TENANT" }, profileId }, { status: 201 });
  }

  // ─── VENDOR ─────────────────────────────────────────
  if (storageRole === "VENDOR") {
    const tempPassword = randomPassword();
    const passwordHash = await hash(tempPassword, 12);
    const user = await db.user.create({
      data: {
        name,
        email,
        phone: body.phone || null,
        companyName: body.companyName || null,
        passwordHash,
        role: "VENDOR",
        mustChangePassword: true,
      },
    });

    await sendCredentialsEmail({
      to: email,
      name,
      tempPassword,
      isDemo: false,
      portalUrl: `${BASE_URL()}/vendor/documents`,
    });

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "CREATE",
      objectType: "User",
      objectId: user.id,
      description: `Admin created VENDOR: ${email}`,
      req,
    });

    return NextResponse.json({ user: { id: user.id, email, role: "VENDOR" } }, { status: 201 });
  }

  // ─── OWNER (Investor) ───────────────────────────────
  if (storageRole === "OWNER") {
    const tempPassword = randomPassword();
    const passwordHash = await hash(tempPassword, 12);
    const user = await db.user.create({
      data: {
        name,
        email,
        phone: body.phone || null,
        companyName: body.companyName || null,
        passwordHash,
        role: "OWNER",
        mustChangePassword: true,
      },
    });

    // If a propertyId is supplied, derive landlordId from the property and
    // auto-create an Owner record linking this User to that property's PM.
    let ownerId: string | null = null;
    if (body.propertyId) {
      const property = await db.property.findUnique({
        where: { id: body.propertyId },
        select: { id: true, landlordId: true },
      });
      if (!property) {
        return NextResponse.json({ error: "Property not found" }, { status: 400 });
      }
      const owner = await db.owner.create({
        data: {
          userId: user.id,
          landlordId: property.landlordId,
          name,
          email,
          phone: body.phone || null,
        },
      });
      ownerId = owner.id;
    }

    await sendCredentialsEmail({
      to: email,
      name,
      tempPassword,
      isDemo: false,
      portalUrl: `${BASE_URL()}/owner`,
    });

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "CREATE",
      objectType: "User",
      objectId: user.id,
      description: `Admin created OWNER: ${email}${ownerId ? ` (linked to property ${body.propertyId})` : ""}`,
      req,
    });

    return NextResponse.json({ user: { id: user.id, email, role: "OWNER" }, ownerId }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported role" }, { status: 400 });
}

// ─── Helpers ──────────────────────────────────────────

function BASE_URL() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
}

async function sendCredentialsEmail(opts: {
  to: string;
  name: string;
  tempPassword: string;
  isDemo: boolean;
  portalUrl?: string;
}) {
  try {
    const { getResend } = await import("@/lib/email");
    const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
      await import("@/lib/emails/_layout");
    const loginUrl = opts.portalUrl || `${BASE_URL()}/login`;
    const demoNote = opts.isDemo
      ? `<p style="font-size:13px;color:#666;background:#fff8e1;padding:10px;border-radius:6px;"><strong>Demo account</strong> — this is a sandbox for showing off DoorStax. Billing and compliance gates are disabled. We'll flip it to a real account whenever you're ready.</p>`
      : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles("")}</style></head><body>
<div class="container"><div class="card">${emailHeader()}
<h1>Your DoorStax account is ready</h1>
<p>Hi ${esc(opts.name)},</p>
<p>An administrator just created a DoorStax account for you.</p>
${demoNote}
<div class="highlight"><p style="margin:0 0 8px 0;font-size:13px;color:#666;">Temporary password</p>
<p style="margin:0;font-family:monospace;font-size:16px;font-weight:600;">${esc(opts.tempPassword)}</p>
<p style="margin:8px 0 0 0;font-size:12px;color:#888;">You'll be asked to set a new password after your first login.</p></div>
${emailButton("Log in", loginUrl)}
<p style="font-size:12px;color:#888;">Email: ${esc(opts.to)}</p>
</div>${emailFooter()}</div></body></html>`;
    await getResend().emails.send({
      from: "DoorStax <noreply@doorstax.com>",
      to: opts.to,
      subject: "Your DoorStax account is ready",
      html,
    });
  } catch (err) {
    console.error("[admin/users] credentials email failed:", err);
  }
}

async function sendSetupLinkEmail(opts: {
  to: string;
  name: string;
  token: string;
  isDemo: boolean;
}) {
  try {
    const { getResend } = await import("@/lib/email");
    const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
      await import("@/lib/emails/_layout");
    const setupUrl = `${BASE_URL()}/onboarding/complete?token=${opts.token}`;
    const demoNote = opts.isDemo
      ? `<p style="font-size:13px;color:#666;background:#fff8e1;padding:10px;border-radius:6px;"><strong>Demo account</strong> — this account is a sandbox with billing gates disabled.</p>`
      : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles("")}</style></head><body>
<div class="container"><div class="card">${emailHeader()}
<h1>Finish setting up your DoorStax account</h1>
<p>Hi ${esc(opts.name)},</p>
<p>An administrator has created a DoorStax account for you. Click below to set your password, accept the Terms of Service, and get started.</p>
${demoNote}
${emailButton("Complete your account setup", setupUrl)}
<p style="font-size:12px;color:#888;">This link expires in 7 days and can only be used once.</p>
</div>${emailFooter()}</div></body></html>`;
    await getResend().emails.send({
      from: "DoorStax <noreply@doorstax.com>",
      to: opts.to,
      subject: "Finish setting up your DoorStax account",
      html,
    });
  } catch (err) {
    console.error("[admin/users] setup-link email failed:", err);
  }
}
