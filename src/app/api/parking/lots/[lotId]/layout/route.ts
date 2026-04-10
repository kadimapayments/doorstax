import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { put, del } from "@vercel/blob";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE_MB = 10;

async function verifyOwnership(lotId: string, userId: string) {
  return db.parkingLot.findFirst({
    where: { id: lotId, property: { landlordId: userId } },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = await params;
    const lot = await verifyOwnership(lotId, session.user.id);
    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type. Accepted: JPG, PNG, WebP, PDF",
        },
        { status: 400 }
      );
    }

    const fileSizeMb = file.size / (1024 * 1024);
    if (fileSizeMb > MAX_SIZE_MB) {
      return NextResponse.json(
        { error: `File too large. Maximum ${MAX_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    // If an existing layout image exists, try to delete it from blob first
    if (lot.layoutImageUrl) {
      try {
        await del(lot.layoutImageUrl);
      } catch {
        // Non-blocking — old file may already be gone
      }
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobPath = `parking/${lotId}/layout-${Date.now()}-${safeFileName}`;

    const blob = await put(blobPath, file, {
      access: "public",
      contentType: file.type,
    });

    await db.parkingLot.update({
      where: { id: lotId },
      data: { layoutImageUrl: blob.url },
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[parking/lots/:id/layout] POST error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = await params;
    const lot = await verifyOwnership(lotId, session.user.id);
    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    if (lot.layoutImageUrl) {
      try {
        await del(lot.layoutImageUrl);
      } catch {
        // Non-blocking
      }
    }

    await db.parkingLot.update({
      where: { id: lotId },
      data: { layoutImageUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[parking/lots/:id/layout] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to remove layout" },
      { status: 500 }
    );
  }
}
