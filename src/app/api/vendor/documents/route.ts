export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
];
const MAX_SIZE_MB = 10;

/**
 * Vendor self-serve documents.
 *
 * GET  — returns the vendor's current W9 status (first Vendor row is
 *        authoritative; all rows for this user share the same W9 across
 *        PMs), plus their bank-on-file summary.
 * POST — multipart upload { file, type: "W9" }. On W9 upload, sets
 *        w9DocumentUrl + w9Status: "RECEIVED" + w9ReceivedAt across
 *        ALL Vendor rows linked to this user (so every PM sees it).
 */

async function requireVendorUser() {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return { error: "Unauthorized" as const, status: 401 as const };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const gate = await requireVendorUser();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  // Any Vendor row linked to this user carries the same W9 + bank info.
  // We pick the first (oldest) for display consistency.
  const vendor = await db.vendor.findFirst({
    where: { userId: gate.userId },
    select: {
      w9Status: true,
      w9DocumentUrl: true,
      w9RequestedAt: true,
      w9ReceivedAt: true,
      bankName: true,
      bankAccountLast4: true,
      bankRoutingLast4: true,
      kadimaCustomerId: true,
      kadimaAccountId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    hasProfile: !!vendor,
    w9Status: vendor?.w9Status || "NOT_REQUESTED",
    w9DocumentUrl: vendor?.w9DocumentUrl ?? null,
    w9RequestedAt: vendor?.w9RequestedAt?.toISOString() ?? null,
    w9ReceivedAt: vendor?.w9ReceivedAt?.toISOString() ?? null,
    bank: vendor?.kadimaAccountId
      ? {
          bankName: vendor.bankName,
          accountLast4: vendor.bankAccountLast4,
          routingLast4: vendor.bankRoutingLast4,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireVendorUser();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = String(formData.get("type") || "W9").toUpperCase();

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, JPEG, PNG, and HEIC files are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `File must be under ${MAX_SIZE_MB}MB` },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobPath = `vendors/${gate.userId}/${Date.now()}-${safeName}`;
  const blob = await put(blobPath, file, {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  // W9 is a vendor-level document that all linked Vendor rows share.
  if (docType === "W9") {
    const updated = await db.vendor.updateMany({
      where: { userId: gate.userId },
      data: {
        w9DocumentUrl: blob.url,
        w9Status: "RECEIVED",
        w9ReceivedAt: new Date(),
      },
    });
    return NextResponse.json({
      ok: true,
      url: blob.url,
      updatedVendorRows: updated.count,
    });
  }

  // Other doc types currently just return the URL for reference; add a
  // VendorDocument model later if we need a per-document history.
  return NextResponse.json({ ok: true, url: blob.url });
}
