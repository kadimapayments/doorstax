/**
 * Job Queue Dispatcher
 *
 * Enqueues jobs into the database for processing by the
 * /api/cron/process-jobs endpoint (runs every 5 minutes).
 *
 * Jobs can also be processed inline for immediate execution.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface EnqueueJobOptions {
  type: string;
  payload: Record<string, unknown>;
  priority?: number;       // Higher = process first (default: 0)
  maxAttempts?: number;    // Default: 3
  runAfter?: Date;         // For delayed execution
}

/**
 * Enqueue a job for background processing.
 * Returns the job ID for tracking.
 */
export async function enqueueJob(opts: EnqueueJobOptions): Promise<string> {
  const job = await db.job.create({
    data: {
      type: opts.type,
      payload: opts.payload as Prisma.InputJsonValue,
      priority: opts.priority ?? 0,
      maxAttempts: opts.maxAttempts ?? 3,
      runAfter: opts.runAfter ?? new Date(),
      status: "QUEUED",
    },
  });

  return job.id;
}
