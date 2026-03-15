import { withCronGuard } from "@/lib/cron-guard";
import { processJobs } from "@/lib/jobs/processor";

/**
 * Job Queue Processor Cron
 *
 * Runs every 5 minutes to drain queued jobs.
 * Processes up to 20 jobs per run, ordered by priority.
 *
 * Schedule: * /5 * * * * (every 5 minutes)
 */
export const GET = withCronGuard("process-jobs", async () => {
  const result = await processJobs({ batchSize: 20 });

  return {
    summary: {
      ...result,
      message: `Processed ${result.processed} jobs, ${result.failed} retried, ${result.dead} dead-lettered`,
    },
  };
});
