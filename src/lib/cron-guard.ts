/**
 * Cron job execution guard.
 *
 * Provides:
 * - CRON_SECRET verification (DRY — no longer duplicated per route)
 * - Overlap prevention (checks for RUNNING status)
 * - Execution tracking via CronRun model
 * - Automatic error handling and status updates
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type CronHandler = () => Promise<{
  summary?: Prisma.InputJsonValue;
}>;

/**
 * Wraps a cron job handler with auth, overlap guard, and tracking.
 */
export function withCronGuard(jobName: string, handler: CronHandler) {
  return async (req: Request) => {
    // ─── Verify CRON_SECRET ──────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Overlap Prevention ──────────────────────────────────
    const running = await db.cronRun.findFirst({
      where: { jobName, status: "RUNNING" },
      orderBy: { startedAt: "desc" },
    });

    if (running) {
      // Check if it's been running for more than 30 minutes (stuck)
      const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);
      if (running.startedAt > stuckThreshold) {
        return NextResponse.json(
          {
            error: "Job already running",
            startedAt: running.startedAt,
          },
          { status: 409 }
        );
      }

      // Mark stuck job as failed
      await db.cronRun.update({
        where: { id: running.id },
        data: {
          status: "FAILED",
          endedAt: new Date(),
          error: "Marked as failed — exceeded 30 minute timeout",
        },
      });
    }

    // ─── Create Run Record ───────────────────────────────────
    const run = await db.cronRun.create({
      data: { jobName, status: "RUNNING" },
    });

    try {
      const result = await handler();

      await db.cronRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
          summary: result.summary ?? undefined,
        },
      });

      return NextResponse.json({
        success: true,
        jobName,
        runId: run.id,
        ...result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await db.cronRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          endedAt: new Date(),
          error: errorMessage,
        },
      });

      console.error(`[cron:${jobName}] Error:`, error);
      return NextResponse.json(
        { error: `Cron job failed: ${errorMessage}` },
        { status: 500 }
      );
    }
  };
}
