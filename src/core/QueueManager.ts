import { v4 as uuidv4 } from 'uuid';
import { Job, JobState, QueueStats } from '../types';
import { JobStorage } from '../storage/JobStorage';
import { ConfigManager } from './ConfigManager';
import { JobExecutor } from './JobExecutor';

/**
 * Core queue manager handling job lifecycle
 */
export class QueueManager {
  private storage: JobStorage;
  private config: ConfigManager;
  private executor: JobExecutor;

  constructor(dataDir: string = './data') {
    this.storage = new JobStorage(dataDir);
    this.config = new ConfigManager(dataDir);
    this.executor = new JobExecutor();
  }

  /**
   * Enqueue a new job
   */
  async enqueue(command: string, maxRetries?: number): Promise<Job> {
    // Validate command
    const validation = this.executor.validateCommand(command);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const configMaxRetries = this.config.get('max_retries');
    const job: Job = {
      id: uuidv4(),
      command,
      state: JobState.PENDING,
      attempts: 0,
      max_retries: maxRetries !== undefined ? maxRetries : configMaxRetries,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await this.storage.addJob(job);
    return job;
  }

  /**
   * Process a single job
   */
  async processJob(jobId: string, workerId: string): Promise<boolean> {
    const job = await this.storage.getJob(jobId);
    if (!job) {
      return false;
    }

    // Mark as processing
    await this.storage.updateJob(jobId, {
      state: JobState.PROCESSING,
      worker_id: workerId
    });

    try {
      // Execute the job
      const result = await this.executor.execute(job.command);

      if (result.success) {
        // Job succeeded
        await this.storage.updateJob(jobId, {
          state: JobState.COMPLETED,
          output: result.output,
          worker_id: undefined
        });
        return true;
      } else {
        // Job failed
        await this.handleJobFailure(jobId, result.error || 'Unknown error');
        return false;
      }
    } catch (error) {
      // Unexpected error
      await this.handleJobFailure(jobId, `Unexpected error: ${error}`);
      return false;
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(jobId: string, errorMessage: string): Promise<void> {
    const job = await this.storage.getJob(jobId);
    if (!job) {
      return;
    }

    const newAttempts = job.attempts + 1;

    if (newAttempts >= job.max_retries) {
      // Move to dead letter queue
      await this.storage.updateJob(jobId, {
        state: JobState.DEAD,
        attempts: newAttempts,
        error_message: errorMessage,
        worker_id: undefined
      });
    } else {
      // Schedule retry with exponential backoff
      const backoffBase = this.config.get('backoff_base');
      const delaySeconds = Math.pow(backoffBase, newAttempts);
      const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

      await this.storage.updateJob(jobId, {
        state: JobState.FAILED,
        attempts: newAttempts,
        error_message: errorMessage,
        next_retry_at: nextRetryAt.toISOString(),
        worker_id: undefined
      });
    }
  }

  /**
   * Get next available job for processing
   */
  async getNextJob(): Promise<Job | null> {
    return await this.storage.getNextPendingJob();
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    return await this.storage.getJob(jobId);
  }

  /**
   * List jobs by state
   */
  async listJobs(state?: JobState): Promise<Job[]> {
    if (state) {
      return await this.storage.getJobsByState(state);
    }
    return await this.storage.readJobs();
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const stats = await this.storage.getStats();
    return {
      pending: stats[JobState.PENDING] + stats[JobState.FAILED],
      processing: stats[JobState.PROCESSING],
      completed: stats[JobState.COMPLETED],
      failed: stats[JobState.FAILED],
      dead: stats[JobState.DEAD],
      active_workers: 0 // Will be updated by WorkerManager
    };
  }

  /**
   * Retry a job from DLQ
   */
  async retryDeadJob(jobId: string): Promise<boolean> {
    const job = await this.storage.getJob(jobId);
    if (!job || job.state !== JobState.DEAD) {
      return false;
    }

    await this.storage.updateJob(jobId, {
      state: JobState.PENDING,
      attempts: 0,
      error_message: undefined,
      next_retry_at: undefined
    });

    return true;
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    return await this.storage.deleteJob(jobId);
  }

  /**
   * Get configuration manager
   */
  getConfigManager(): ConfigManager {
    return this.config;
  }

  /**
   * Reset a stuck processing job (for recovery)
   */
  async resetStuckJobs(): Promise<number> {
    const jobs = await this.storage.readJobs();
    let resetCount = 0;

    for (const job of jobs) {
      if (job.state === JobState.PROCESSING) {
        await this.storage.updateJob(job.id, {
          state: JobState.PENDING,
          worker_id: undefined
        });
        resetCount++;
      }
    }

    return resetCount;
  }
}
