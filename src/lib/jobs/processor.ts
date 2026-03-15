/**
 * Job Queue Processor
 *
 * Drains queued jobs from the database, executes them via
 * registered handlers, and tracks results.
 *
 * Called by /api/cron/process-jobs every 5 minutes.
 *
 * Features:
 * - Atomic status transitions (prevents double-processing)
 * - Exponential backoff on failure
 * - Dead-letter after maxAttempts exceeded
 * - Priority ordering
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getJobHandler } from "./handlers";

export interface ProcessJobsOptions {
  batchSize?: number;   // Default: 10
  types?: string[];     // Filter to specific job types
}

export interface ProcessJobsResult {
  processed: number;
  failed: number;
  dead: number;
}

/**
 * Process queued jobs.
 */
export async function processJobs(
  opts?: ProcessJobsOptions
): Promise<ProcessJobsResult> {
  const batchSize = opts?.batchSize ?? 10;
  const result: ProcessJobsResult = { processed: 0, failed: 0, dead: 0 };

  // Find eligible jobs
  const jobs = await db.job.findMany({
    where: {
      status: "QUEUED",
      runAfter: { lte: new Date() },
      ...(opts?.types ? { type: { in: opts.types } } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: batchSize,
  });

  for (const job of jobs) {
    // Atomically claim the job (prevents double-processing)
    const claimed = await db.job.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        startedAt: new Date(),
      },
    });

    // Another worker claimed it first
    if (claimed.count === 0) continue;

    const handler = getJobHandler(job.type);
    if (!handler) {
      console.error(`[jobs] No handler registered for job type: ${job.type}`);
      await db.job.update({
        where: { id: job.id },
        data: {
          status: "DEAD",
          lastError: `No handler registered for type: ${job.type}`,
          completedAt: new Date(),
        },
      });
      result.dead++;
      continue;
    }

    try {
      const jobResult = await handler(job.payload as Record<string, unknown>);
      await db.job.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          result: (jobResult as Prisma.InputJsonValue) ?? undefined,
        },
      });
      result.processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = job.attempts + 1;

      if (newAttempts >= job.maxAttempts) {
        // Max retries exceeded — dead letter
        await db.job.update({
          where: { id: job.id },
          data: {
            status: "DEAD",
            lastError: errorMsg,
            completedAt: new Date(),
          },
        });
        result.dead++;
      } else {
        // Exponential backoff: 30s, 2min, 8min, 32min...
        const delayMs = Math.pow(4, newAttempts) * 30_000;
        const runAfter = new Date(Date.now() + delayMs);
        await db.job.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            lastError: errorMsg,
            runAfter,
          },
        });
        result.failed++;
      }

      console.error(
        `[jobs] Job ${job.id} (${job.type}) failed (attempt ${newAttempts}/${job.maxAttempts}):`,
        err
      );
    }
  }

  return result;
}
