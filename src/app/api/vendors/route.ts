import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const vendors = await db.vendor.findMany({
    where: { landlordId },
    include: {
      tickets: { select: { id: true, status: true } },
      user: { select: { id: true, email: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(vendors);
}

/**
 * Add a vendor to this PM's vendor list.
 *
 * Three modes:
 *   1. `userId` supplied — link an existing VENDOR user (from the "Add existing
 *      vendor" search). No invite email, since they already have an account.
 *   2. `email` supplied — look up any existing VENDOR user with that email.
 *        - Match: create a Vendor row linked to that userId. Send a
 *          notification email ("PM X added you to their vendor network").
 *        - No match: create a new User (role=VENDOR) with a temp password,
 *          link the Vendor, send the full portal-invite email.
 *   3. No email — create a legacy Vendor row with userId=null. Vendor has no
 *      portal access until the PM later provides an email and re-invites.
 *
 * Prevents duplicate Vendor rows for the same PM+user (returns 409).
 */
export async function POST(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);

  const body = await req.json().catch(() => ({}));
  const {
    userId: linkUserId,
    name,
    email,
    phone,
    company,
    category,
    notes,
  } = body as {
    userId?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    category?: string;
    notes?: string;
  };

  if (!name && !linkUserId) {
    return NextResponse.json(
      { error: "Either a userId (existing vendor) or name (new vendor) is required" },
      { status: 400 }
    );
  }

  const pmUser = await db.user.findUnique({
    where: { id: landlordId },
    select: { name: true, companyName: true },
  });
  const pmDisplayName =
    pmUser?.companyName || pmUser?.name || "Your Property Manager";

  // ──────────────────────────────────────────────────────
  // Mode 1: link existing vendor (from search)
  // ──────────────────────────────────────────────────────
  if (linkUserId) {
    const targetUser = await db.user.findUnique({
      where: { id: linkUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        role: true,
      },
    });
    if (!targetUser || targetUser.role !== "VENDOR") {
      return NextResponse.json(
        { error: "That user is not a vendor" },
        { status: 400 }
      );
    }
    const dup = await db.vendor.findFirst({
      where: { landlordId, userId: targetUser.id },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: "This vendor is already in your network" },
        { status: 409 }
      );
    }
    const vendor = await db.vendor.create({
      data: {
        landlordId,
        userId: targetUser.id,
        name: targetUser.name || name || "Vendor",
        email: targetUser.email,
        phone: targetUser.phone,
        company: targetUser.companyName || company || null,
        category: category || "GENERAL",
        notes: notes || null,
      },
    });
    // Notify the vendor that a new PM added them
    sendVendorAddedNotification(targetUser.email, targetUser.name || "there", pmDisplayName).catch(
      (e) => console.error("[vendor-add] notification failed:", e)
    );
    return NextResponse.json({ vendor, linked: true }, { status: 201 });
  }

  // ──────────────────────────────────────────────────────
  // Mode 2: email supplied — dedupe against existing VENDOR user
  // ──────────────────────────────────────────────────────
  const cleanEmail = email ? String(email).toLowerCase().trim() : null;
  let attachedUserId: string | null = null;
  let createdNewUser = false;
  let tempPassword: string | null = null;

  if (cleanEmail) {
    const existing = await db.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, role: true },
    });
    if (existing && existing.role === "VENDOR") {
      // Linked an existing vendor by email
      const dup = await db.vendor.findFirst({
        where: { landlordId, userId: existing.id },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { error: "This vendor is already in your network" },
          { status: 409 }
        );
      }
      attachedUserId = existing.id;
    } else if (existing && existing.role !== "VENDOR") {
      return NextResponse.json(
        {
          error:
            "That email belongs to a non-vendor account. Ask the vendor to use a different email.",
        },
        { status: 409 }
      );
    } else {
      // No existing user — create one
      const { hash } = await import("bcryptjs");
      tempPassword = randomBytes(12).toString("base64url");
      const newUser = await db.user.create({
        data: {
          email: cleanEmail,
          name: name || "Vendor",
          phone: phone || null,
          companyName: company || null,
          passwordHash: await hash(tempPassword, 12),
          role: "VENDOR",
        },
      });
      attachedUserId = newUser.id;
      createdNewUser = true;
    }
  }

  // ──────────────────────────────────────────────────────
  // Create the Vendor record
  // ──────────────────────────────────────────────────────
  const vendor = await db.vendor.create({
    data: {
      landlordId,
      userId: attachedUserId,
      name: name || "Vendor",
      email: cleanEmail,
      phone: phone || null,
      company: company || null,
      category: category || "GENERAL",
      notes: notes || null,
    },
  });

  // ──────────────────────────────────────────────────────
  // Fire-and-forget email
  // ──────────────────────────────────────────────────────
  if (cleanEmail) {
    if (createdNewUser && tempPassword) {
      sendVendorInviteEmail(
        cleanEmail,
        name || "Vendor",
        pmDisplayName,
        tempPassword
      ).catch((e) => console.error("[vendor-add] invite failed:", e));
    } else if (attachedUserId) {
      sendVendorAddedNotification(cleanEmail, name || "Vendor", pmDisplayName).catch(
        (e) => console.error("[vendor-add] notification failed:", e)
      );
    }
  }

  return NextResponse.json(
    { vendor, linked: !createdNewUser && !!attachedUserId, invited: createdNewUser },
    { status: 201 }
  );
}

// ──────────────────────────────────────────────────────
// Email helpers — fire-and-forget, logged on error
// ──────────────────────────────────────────────────────

async function sendVendorInviteEmail(
  to: string,
  name: string,
  pmName: string,
  tempPassword: string
) {
  const { getResend } = await import("@/lib/email");
  const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
    await import("@/lib/emails/_layout");
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
  const loginUrl = `${BASE_URL}/login`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>Welcome to DoorStax</h1><p>Hi ${esc(name)},</p><p><strong>${esc(pmName)}</strong> has added you as a vendor. Your DoorStax Vendor Portal account is ready — log in to see assigned service tickets, submit invoices, and manage your W-9 and bank account for payouts.</p><div class="highlight"><p style="margin:0 0 8px 0;font-size:13px;color:#666;">Your temporary password</p><p style="margin:0;font-family:monospace;font-size:16px;font-weight:600;word-break:break-all;">${esc(tempPassword)}</p><p style="margin:8px 0 0 0;font-size:12px;color:#888;">You'll be asked to change it after your first login.</p></div>${emailButton("Log in to Vendor Portal", loginUrl)}<p style="font-size:12px;color:#888;">Email: ${esc(to)}</p></div>${emailFooter()}</div></body></html>`;
  await getResend().emails.send({
    from: "DoorStax <noreply@doorstax.com>",
    to,
    subject: `${pmName} added you as a vendor — Welcome to DoorStax`,
    html,
  });
}

async function sendVendorAddedNotification(
  to: string | null,
  name: string,
  pmName: string
) {
  if (!to) return;
  const { getResend } = await import("@/lib/email");
  const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
    await import("@/lib/emails/_layout");
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>A new property manager added you</h1><p>Hi ${esc(name)},</p><p><strong>${esc(pmName)}</strong> just added you to their DoorStax vendor network. You'll start receiving service tickets from them — log in to your portal to see assignments, submit invoices, and track payouts.</p>${emailButton("Open Vendor Portal", `${BASE_URL}/vendor`)}</div>${emailFooter()}</div></body></html>`;
  await getResend().emails.send({
    from: "DoorStax <noreply@doorstax.com>",
    to,
    subject: `${pmName} added you to their vendor network`,
    html,
  });
}
