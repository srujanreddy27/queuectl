import * as fs from 'fs';
import * as path from 'path';
import { Worker } from './Worker';
import { QueueManager } from '../core/QueueManager';

/**
 * Manages multiple worker processes
 */
export class WorkerManager {
  private workers: Map<string, Worker>;
  private queueManager: QueueManager;
  private dataDir: string;
  private pidFile: string;
  private isShuttingDown: boolean;

  constructor(dataDir: string = './data') {
    this.workers = new Map();
    this.queueManager = new QueueManager(dataDir);
    this.dataDir = dataDir;
    this.pidFile = path.join(dataDir, 'workers.pid');
    this.isShuttingDown = false;
  }

  /**
   * Start workers
   */
  async start(count: number = 1): Promise<void> {
    if (count < 1) {
      throw new Error('Worker count must be at least 1');
    }

    // Check if workers are already running
    if (this.isRunning()) {
      throw new Error('Workers are already running. Stop them first.');
    }

    // Reset any stuck jobs from previous runs
    const resetCount = await this.queueManager.resetStuckJobs();
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} stuck job(s) from previous run`);
    }

    // Start workers
    for (let i = 0; i < count; i++) {
      const worker = new Worker(this.queueManager);
      this.workers.set(worker.getId(), worker);
      worker.start();
    }

    // Save PID file
    this.savePidFile();

    console.log(`Started ${count} worker(s)`);

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  /**
   * Stop all workers gracefully
   */
  async stop(): Promise<void> {
    if (this.workers.size === 0) {
      console.log('No workers are running');
      return;
    }

    this.isShuttingDown = true;
    console.log('Stopping workers gracefully...');

    const stopPromises = Array.from(this.workers.values()).map(worker => 
      worker.stop()
    );

    await Promise.all(stopPromises);
    this.workers.clear();
    this.removePidFile();

    console.log('All workers stopped');
  }

  /**
   * Check if workers are running
   */
  isRunning(): boolean {
    return this.workers.size > 0 || fs.existsSync(this.pidFile);
  }

  /**
   * Get worker statistics
   */
  getWorkerStats(): Array<{
    id: string;
    state: string;
    currentJob?: string;
    jobsCompleted: number;
    jobsFailed: number;
  }> {
    return Array.from(this.workers.values()).map(worker => worker.getStats());
  }

  /**
   * Save PID file
   */
  private savePidFile(): void {
    const dir = path.dirname(this.pidFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      pid: process.pid,
      workers: Array.from(this.workers.keys()),
      started_at: new Date().toISOString()
    };

    fs.writeFileSync(this.pidFile, JSON.stringify(data, null, 2));
  }

  /**
   * Remove PID file
   */
  private removePidFile(): void {
    if (fs.existsSync(this.pidFile)) {
      fs.unlinkSync(this.pidFile);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }

      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      await this.stop();
      Deno.exit(0);
    };

    Deno.addSignalListener('SIGTERM', () => shutdown('SIGTERM'));
    Deno.addSignalListener('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Keep the process alive while workers are running
   */
  async keepAlive(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.workers.size === 0 || this.isShuttingDown) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Get queue manager instance
   */
  getQueueManager(): QueueManager {
    return this.queueManager;
  }
}
