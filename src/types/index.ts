/**
 * Job state enumeration
 */
export enum JobState {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DEAD = 'dead'
}

/**
 * Job interface representing a background task
 */
export interface Job {
  id: string;
  command: string;
  state: JobState;
  attempts: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  next_retry_at?: string;
  error_message?: string;
  output?: string;
  worker_id?: string;
}

/**
 * Configuration interface for the queue system
 */
export interface QueueConfig {
  max_retries: number;
  backoff_base: number;
  worker_poll_interval: number;
  graceful_shutdown_timeout: number;
}

/**
 * Worker information interface
 */
export interface WorkerInfo {
  id: string;
  pid: number;
  state: 'idle' | 'busy' | 'stopping';
  current_job_id?: string;
  started_at: string;
  jobs_completed: number;
  jobs_failed: number;
}

/**
 * Queue statistics interface
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
  active_workers: number;
}

/**
 * Job execution result
 */
export interface JobResult {
  success: boolean;
  output?: string;
  error?: string;
  exit_code?: number;
}
