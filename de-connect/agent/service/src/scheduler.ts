/**
 * Sync Scheduler
 *
 * Schedules and manages sync operations using cron expressions.
 */

import { Cron } from 'croner';
import { createLogger, type Logger } from '@de-connect/shared';

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /**
   * Cron expression for sync schedule
   */
  syncSchedule: string;

  /**
   * Timezone for cron evaluation
   */
  timezone?: string;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Scheduled job info
 */
export interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  nextRun: Date | null;
  lastRun: Date | null;
  isRunning: boolean;
}

/**
 * Job execution context
 */
export interface JobContext {
  jobId: string;
  scheduledTime: Date;
  attempt: number;
}

/**
 * Sync Scheduler
 */
export class SyncScheduler {
  private logger: Logger;
  private jobs: Map<string, { cron: Cron; info: ScheduledJob; handler: () => Promise<void> }> = new Map();

  constructor(private config: SchedulerConfig) {
    this.logger = config.logger ?? createLogger('SyncScheduler');
  }

  /**
   * Add a scheduled job
   */
  addJob(
    id: string,
    name: string,
    schedule: string,
    handler: (ctx: JobContext) => Promise<void>
  ): void {
    if (this.jobs.has(id)) {
      this.removeJob(id);
    }

    const info: ScheduledJob = {
      id,
      name,
      schedule,
      nextRun: null,
      lastRun: null,
      isRunning: false,
    };

    let attempt = 0;

    const wrappedHandler = async (): Promise<void> => {
      if (info.isRunning) {
        this.logger.warn('Job already running, skipping', { jobId: id });
        return;
      }

      attempt++;
      info.isRunning = true;
      const scheduledTime = new Date();

      this.logger.info('Starting scheduled job', {
        jobId: id,
        name,
        attempt,
      });

      try {
        await handler({ jobId: id, scheduledTime, attempt });
        info.lastRun = new Date();
        this.logger.info('Job completed', { jobId: id, name });
      } catch (error) {
        this.logger.error('Job failed', error instanceof Error ? error : undefined, {
          jobId: id,
          name,
        });
      } finally {
        info.isRunning = false;
        this.updateNextRun(id);
      }
    };

    const cron = new Cron(schedule, {
      timezone: this.config.timezone,
      paused: true,
    }, wrappedHandler);

    this.jobs.set(id, { cron, info, handler: wrappedHandler });
    this.updateNextRun(id);

    this.logger.info('Added scheduled job', {
      jobId: id,
      name,
      schedule,
      nextRun: info.nextRun?.toISOString(),
    });
  }

  /**
   * Start all jobs
   */
  start(): void {
    for (const [id, job] of this.jobs) {
      job.cron.resume();
      this.updateNextRun(id);
      this.logger.info('Started job', { jobId: id, nextRun: job.info.nextRun?.toISOString() });
    }
  }

  /**
   * Stop all jobs
   */
  stop(): void {
    for (const [id, job] of this.jobs) {
      job.cron.pause();
      this.logger.info('Stopped job', { jobId: id });
    }
  }

  /**
   * Remove a job
   */
  removeJob(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.cron.stop();
      this.jobs.delete(id);
      this.logger.info('Removed job', { jobId: id });
    }
  }

  /**
   * Get job info
   */
  getJob(id: string): ScheduledJob | null {
    return this.jobs.get(id)?.info ?? null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values()).map(j => ({ ...j.info }));
  }

  /**
   * Trigger a job immediately
   */
  async triggerJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    this.logger.info('Manually triggering job', { jobId: id });
    await job.handler();
  }

  /**
   * Update next run time for a job
   */
  private updateNextRun(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      const next = job.cron.nextRun();
      job.info.nextRun = next ?? null;
    }
  }

  /**
   * Check if any job is currently running
   */
  isAnyJobRunning(): boolean {
    for (const job of this.jobs.values()) {
      if (job.info.isRunning) return true;
    }
    return false;
  }

  /**
   * Wait for all running jobs to complete
   */
  async waitForCompletion(timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (this.isAnyJobRunning()) {
      if (Date.now() - startTime > timeoutMs) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return true;
  }

  /**
   * Dispose scheduler
   */
  dispose(): void {
    for (const job of this.jobs.values()) {
      job.cron.stop();
    }
    this.jobs.clear();
  }
}

/**
 * Parse a cron expression and get next run time
 */
export function getNextRunTime(schedule: string, timezone?: string): Date | null {
  try {
    const cron = new Cron(schedule, { timezone });
    return cron.nextRun() ?? null;
  } catch {
    return null;
  }
}

/**
 * Validate a cron expression
 */
export function validateCronExpression(schedule: string): boolean {
  try {
    new Cron(schedule);
    return true;
  } catch {
    return false;
  }
}
