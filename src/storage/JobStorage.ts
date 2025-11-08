import * as fs from 'fs';
import * as path from 'path';
import { Job, JobState } from '../types';

/**
 * File-based persistent storage for jobs
 * Uses atomic write operations to prevent corruption
 */
export class JobStorage {
  private dataDir: string;
  private jobsFile: string;
  private lockFile: string;

  constructor(dataDir: string = './data') {
    this.dataDir = path.resolve(dataDir);
    this.jobsFile = path.join(this.dataDir, 'jobs.json');
    this.lockFile = path.join(this.dataDir, 'jobs.lock');
    this.ensureDataDir();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Acquire file lock for atomic operations
   */
  private async acquireLock(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (fs.existsSync(this.lockFile)) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Failed to acquire lock: timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    fs.writeFileSync(this.lockFile, process.pid.toString());
  }

  /**
   * Release file lock
   */
  private releaseLock(): void {
    if (fs.existsSync(this.lockFile)) {
      fs.unlinkSync(this.lockFile);
    }
  }

  /**
   * Read all jobs from storage
   */
  async readJobs(): Promise<Job[]> {
    try {
      await this.acquireLock();
      
      if (!fs.existsSync(this.jobsFile)) {
        this.releaseLock();
        return [];
      }

      const data = fs.readFileSync(this.jobsFile, 'utf-8');
      const jobs = JSON.parse(data) as Job[];
      this.releaseLock();
      return jobs;
    } catch (error) {
      this.releaseLock();
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Write all jobs to storage atomically
   */
  async writeJobs(jobs: Job[]): Promise<void> {
    try {
      await this.acquireLock();
      
      const tempFile = `${this.jobsFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(jobs, null, 2), 'utf-8');
      
      // Atomic rename
      fs.renameSync(tempFile, this.jobsFile);
      
      this.releaseLock();
    } catch (error) {
      this.releaseLock();
      throw error;
    }
  }

  /**
   * Add a new job
   */
  async addJob(job: Job): Promise<void> {
    const jobs = await this.readJobs();
    jobs.push(job);
    await this.writeJobs(jobs);
  }

  /**
   * Update an existing job
   */
  async updateJob(jobId: string, updates: Partial<Job>): Promise<boolean> {
    const jobs = await this.readJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    
    if (index === -1) {
      return false;
    }

    jobs[index] = {
      ...jobs[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    await this.writeJobs(jobs);
    return true;
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    const jobs = await this.readJobs();
    return jobs.find(j => j.id === jobId) || null;
  }

  /**
   * Get jobs by state
   */
  async getJobsByState(state: JobState): Promise<Job[]> {
    const jobs = await this.readJobs();
    return jobs.filter(j => j.state === state);
  }

  /**
   * Get next pending job (FIFO with retry time consideration)
   */
  async getNextPendingJob(): Promise<Job | null> {
    const jobs = await this.readJobs();
    const now = new Date();
    
    const availableJobs = jobs.filter(j => {
      if (j.state !== JobState.PENDING && j.state !== JobState.FAILED) {
        return false;
      }
      
      // Check if retry time has passed
      if (j.next_retry_at) {
        return new Date(j.next_retry_at) <= now;
      }
      
      return true;
    });

    // Sort by created_at (FIFO)
    availableJobs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return availableJobs[0] || null;
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    const jobs = await this.readJobs();
    const filtered = jobs.filter(j => j.id !== jobId);
    
    if (filtered.length === jobs.length) {
      return false;
    }

    await this.writeJobs(filtered);
    return true;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<Record<JobState, number>> {
    const jobs = await this.readJobs();
    const stats: Record<JobState, number> = {
      [JobState.PENDING]: 0,
      [JobState.PROCESSING]: 0,
      [JobState.COMPLETED]: 0,
      [JobState.FAILED]: 0,
      [JobState.DEAD]: 0
    };

    jobs.forEach(job => {
      stats[job.state]++;
    });

    return stats;
  }

  /**
   * Clean up old completed jobs (optional maintenance)
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    const jobs = await this.readJobs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filtered = jobs.filter(j => {
      if (j.state !== JobState.COMPLETED) {
        return true;
      }
      return new Date(j.updated_at) > cutoffDate;
    });

    const removed = jobs.length - filtered.length;
    if (removed > 0) {
      await this.writeJobs(filtered);
    }

    return removed;
  }
}
