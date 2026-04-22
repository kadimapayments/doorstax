import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/tickets/[id]/completion-proof
 *
 * Vendor submits proof of work completion — photos + an explanation of
 * what was done. Writes to ServiceTicket.completionNotes / completionImages /
 * completionSubmittedAt / completionSubmittedById. Optionally also
 * transitions the ticket to RESOLVED in the same shot (default: yes,
 * unless `?stayInProgress=1` is passed, which lets a vendor drop interim
 * proof without closing the ticket).
 *
 * Accepts multipart/form-data with:
 *   - files: one or more File fields named "file" (up to 10)
 *   - notes: explanation text (required if no files)
 *
 * Access: only the vendor assigned to the ticket. Keeps it tight so a
 * PM-uploaded "proof" (which would be odd) doesn't accidentally happen
 * through this route.
 *
 * Idempotency: not strictly idempotent — each call APPENDS to the image
 * array (so a vendor can add more photos later without wiping the first
 * batch). `completionSubmittedAt` / `completionSubmittedById` are only
 * set on the first successful call; subsequent calls leave them alone.
 */

const ACCEPTED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/pdf", // some vendors photograph receipts as PDF
];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB per photo
const MAX_FILES_PER_REQUEST = 10;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json(
      { error: "Only the assigned vendor can submit completion proof" },
      { status: 401 }
    );
  }
  const { id } = await params;

  const ticket = await db.serviceTicket.findUnique({
    where: { id },
    include: { vendor: { select: { userId: true } } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (ticket.vendor?.userId !== session.user.id) {
    return NextResponse.json(
      { error: "This ticket isn't assigned to you" },
      { status: 403 }
    );
  }
  if (ticket.status !== "IN_PROGRESS" && ticket.status !== "RESOLVED") {
    return NextResponse.json(
      {
        error:
          "Completion proof can only be submitted once the job is In Progress. Tap 'Start Work' first.",
      },
      { status: 409 }
    );
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    const notes = ((formData.get("notes") as string | null) || "").trim();
    const stayInProgress = req.nextUrl.searchParams.get("stayInProgress") === "1";

    if (files.length === 0 && !notes) {
      return NextResponse.json(
        { error: "Add at least one photo OR a written explanation" },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Up to ${MAX_FILES_PER_REQUEST} files per submission` },
        { status: 400 }
      );
    }
    for (const f of files) {
      if (!ACCEPTED_MIMES.includes(f.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${f.type}` },
          { status: 400 }
        );
      }
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${f.name} is larger than 15 MB` },
          { status: 400 }
        );
      }
    }

    // Upload every file to Blob in parallel.
    const uploadedUrls: string[] = [];
    try {
      const results = await Promise.all(
        files.map((file) => {
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `service-tickets/${id}/completion-proof/${Date.now()}-${safe}`;
          return put(path, file, {
            access: "public",
            contentType: file.type,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
        })
      );
      uploadedUrls.push(...results.map((r) => r.url));
    } catch (blobErr) {
      const msg = blobErr instanceof Error ? blobErr.message : String(blobErr);
      console.error("[tickets/completion-proof] blob put failed:", msg);
      if (/private\s+store|private\s+access/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Blob storage is set to private — DoorStax photo uploads require a public Blob store. Contact support.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Upload rejected by storage: ${msg}` },
        { status: 502 }
      );
    }

    const updateData: Record<string, unknown> = {
      completionImages: [...ticket.completionImages, ...uploadedUrls],
    };
    if (notes) {
      // Append notes if the vendor is filing a second round of proof;
      // keeps earlier context visible.
      updateData.completionNotes = ticket.completionNotes
        ? `${ticket.completionNotes}\n\n---\n${notes}`
        : notes;
    }
    if (!ticket.completionSubmittedAt) {
      updateData.completionSubmittedAt = new Date();
      updateData.completionSubmittedById = session.user.id;
    }

    // Auto-transition to RESOLVED on first submission unless the
    // vendor explicitly asked to stay in progress.
    const shouldResolve =
      !stayInProgress &&
      ticket.status === "IN_PROGRESS" &&
      !ticket.completionSubmittedAt;
    if (shouldResolve) {
      updateData.status = "RESOLVED";
      updateData.resolvedAt = new Date();
      updateData.completedDate = new Date();
    }

    const updated = await db.serviceTicket.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      ticket: {
        id: updated.id,
        status: updated.status,
        completionNotes: updated.completionNotes,
        completionImages: updated.completionImages,
        completionSubmittedAt: updated.completionSubmittedAt,
      },
      transitionedToResolved: shouldResolve,
    });
  } catch (err) {
    console.error("[tickets/completion-proof] error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to submit completion proof",
      },
      { status: 500 }
    );
  }
}
