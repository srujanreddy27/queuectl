import { v4 as uuidv4 } from 'uuid';
import { QueueManager } from '../core/QueueManager';

/**
 * Individual worker that processes jobs from the queue
 */
export class Worker {
  private id: string;
  private queueManager: QueueManager;
  private state: 'idle' | 'busy' | 'stopping';
  private currentJobId?: string;
  private jobsCompleted: number;
  private jobsFailed: number;
  private isRunning: boolean;
  private pollInterval: number;
  private pollTimer?: NodeJS.Timeout;

  constructor(queueManager: QueueManager) {
    this.id = uuidv4();
    this.queueManager = queueManager;
    this.state = 'idle';
    this.jobsCompleted = 0;
    this.jobsFailed = 0;
    this.isRunning = false;
    this.pollInterval = queueManager.getConfigManager().get('worker_poll_interval');
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.state = 'idle';
    this.poll();
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    this.state = 'stopping';
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }

    // Wait for current job to finish
    const timeout = this.queueManager.getConfigManager().get('graceful_shutdown_timeout');
    const startTime = Date.now();

    while (this.state === 'stopping' && this.currentJobId) {
      if (Date.now() - startTime > timeout) {
        console.warn(`Worker ${this.id} forced shutdown - job ${this.currentJobId} may be incomplete`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Poll for jobs
   */
  private poll(): void {
    if (!this.isRunning) {
      return;
    }

    this.processNextJob()
      .catch(error => {
        console.error(`Worker ${this.id} error:`, error);
      })
      .finally(() => {
        if (this.isRunning) {
          this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
        }
      });
  }

  /**
   * Process the next available job
   */
  private async processNextJob(): Promise<void> {
    if (this.state !== 'idle') {
      return;
    }

    const job = await this.queueManager.getNextJob();
    if (!job) {
      return;
    }

    this.state = 'busy';
    this.currentJobId = job.id;

    try {
      const success = await this.queueManager.processJob(job.id, this.id);
      
      if (success) {
        this.jobsCompleted++;
      } else {
        this.jobsFailed++;
      }
    } catch (error) {
      console.error(`Worker ${this.id} failed to process job ${job.id}:`, error);
      this.jobsFailed++;
    } finally {
      this.currentJobId = undefined;
      this.state = this.isRunning ? 'idle' : 'stopping';
    }
  }

  /**
   * Get worker ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    id: string;
    state: string;
    currentJob?: string;
    jobsCompleted: number;
    jobsFailed: number;
  } {
    return {
      id: this.id,
      state: this.state,
      currentJob: this.currentJobId,
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed
    };
  }
}
