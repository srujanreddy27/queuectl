#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { QueueManager } from './core/QueueManager';
import { WorkerManager } from './workers/WorkerManager';
import { JobState } from './types';

const program = new Command();
const DATA_DIR = process.env.QUEUECTL_DATA_DIR || './data';

program
  .name('queuectl')
  .description('A production-grade CLI-based background job queue system')
  .version('1.0.0');

/**
 * Enqueue command
 */
program
  .command('enqueue')
  .description('Add a new job to the queue')
  .argument('<job>', 'Job JSON string or command')
  .option('-r, --retries <number>', 'Maximum retry attempts', parseInt)
  .action(async (jobArg: string, options) => {
    try {
      const queueManager = new QueueManager(DATA_DIR);
      let command: string;
      let maxRetries: number | undefined = options.retries;

      // Try to parse as JSON first
      try {
        const jobData = JSON.parse(jobArg);
        command = jobData.command;
        if (jobData.max_retries !== undefined) {
          maxRetries = jobData.max_retries;
        }
      } catch {
        // If not JSON, treat as command string
        command = jobArg;
      }

      const job = await queueManager.enqueue(command, maxRetries);
      
      console.log(chalk.green('✓ Job enqueued successfully'));
      console.log(chalk.gray(`Job ID: ${job.id}`));
      console.log(chalk.gray(`Command: ${job.command}`));
      console.log(chalk.gray(`Max Retries: ${job.max_retries}`));
    } catch (error) {
      console.error(chalk.red('✗ Failed to enqueue job:'), error);
      process.exit(1);
    }
  });

/**
 * Worker commands
 */
const workerCmd = program.command('worker').description('Manage workers');

workerCmd
  .command('start')
  .description('Start worker processes')
  .option('-c, --count <number>', 'Number of workers to start', '1')
  .action(async (options) => {
    try {
      const count = parseInt(options.count);
      if (isNaN(count) || count < 1) {
        throw new Error('Worker count must be a positive number');
      }

      const workerManager = new WorkerManager(DATA_DIR);
      await workerManager.start(count);
      
      console.log(chalk.green(`✓ Started ${count} worker(s)`));
      console.log(chalk.gray('Press Ctrl+C to stop workers gracefully'));
      
      // Keep process alive
      await workerManager.keepAlive();
    } catch (error) {
      console.error(chalk.red('✗ Failed to start workers:'), error);
      process.exit(1);
    }
  });

workerCmd
  .command('stop')
  .description('Stop all running workers gracefully')
  .action(async () => {
    try {
      const workerManager = new WorkerManager(DATA_DIR);
      await workerManager.stop();
      console.log(chalk.green('✓ Workers stopped'));
    } catch (error) {
      console.error(chalk.red('✗ Failed to stop workers:'), error);
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command('status')
  .description('Show queue status and statistics')
  .action(async () => {
    try {
      const queueManager = new QueueManager(DATA_DIR);
      const stats = await queueManager.getStats();

      console.log(chalk.bold('\n📊 Queue Status\n'));

      const table = new Table({
        head: [chalk.cyan('State'), chalk.cyan('Count')],
        style: { head: [], border: [] }
      });

      table.push(
        ['Pending', chalk.yellow(stats.pending.toString())],
        ['Processing', chalk.blue(stats.processing.toString())],
        ['Completed', chalk.green(stats.completed.toString())],
        ['Failed (Retrying)', chalk.magenta(stats.failed.toString())],
        ['Dead (DLQ)', chalk.red(stats.dead.toString())]
      );

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal Jobs: ${stats.pending + stats.processing + stats.completed + stats.failed + stats.dead}`));
    } catch (error) {
      console.error(chalk.red('✗ Failed to get status:'), error);
      process.exit(1);
    }
  });

/**
 * List command
 */
program
  .command('list')
  .description('List jobs')
  .option('-s, --state <state>', 'Filter by state (pending|processing|completed|failed|dead)')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .action(async (options) => {
    try {
      const queueManager = new QueueManager(DATA_DIR);
      const state = options.state ? (options.state as JobState) : undefined;
      const limit = parseInt(options.limit);

      let jobs = await queueManager.listJobs(state);
      
      if (jobs.length === 0) {
        console.log(chalk.gray('No jobs found'));
        return;
      }

      // Sort by created_at descending
      jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Apply limit
      jobs = jobs.slice(0, limit);

      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Command'),
          chalk.cyan('State'),
          chalk.cyan('Attempts'),
          chalk.cyan('Created')
        ],
        colWidths: [38, 40, 12, 10, 20],
        wordWrap: true,
        style: { head: [], border: [] }
      });

      jobs.forEach(job => {
        const stateColor = {
          [JobState.PENDING]: chalk.yellow,
          [JobState.PROCESSING]: chalk.blue,
          [JobState.COMPLETED]: chalk.green,
          [JobState.FAILED]: chalk.magenta,
          [JobState.DEAD]: chalk.red
        }[job.state];

        table.push([
          job.id.substring(0, 8) + '...',
          job.command.substring(0, 37) + (job.command.length > 37 ? '...' : ''),
          stateColor(job.state),
          `${job.attempts}/${job.max_retries}`,
          new Date(job.created_at).toLocaleString()
        ]);
      });

      console.log(table.toString());
      console.log(chalk.gray(`\nShowing ${jobs.length} job(s)`));
    } catch (error) {
      console.error(chalk.red('✗ Failed to list jobs:'), error);
      process.exit(1);
    }
  });

/**
 * DLQ commands
 */
const dlqCmd = program.command('dlq').description('Manage Dead Letter Queue');

dlqCmd
  .command('list')
  .description('List jobs in Dead Letter Queue')
  .action(async () => {
    try {
      const queueManager = new QueueManager(DATA_DIR);
      const jobs = await queueManager.listJobs(JobState.DEAD);

      if (jobs.length === 0) {
        console.log(chalk.gray('No jobs in Dead Letter Queue'));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Command'),
          chalk.cyan('Attempts'),
          chalk.cyan('Error'),
          chalk.cyan('Failed At')
        ],
        colWidths: [38, 30, 10, 30, 20],
        wordWrap: true,
        style: { head: [], border: [] }
      });

      jobs.forEach(job => {
        table.push([
          job.id,
          job.command.substring(0, 27) + (job.command.length > 27 ? '...' : ''),
          job.attempts.toString(),
          (job.error_message || 'Unknown').substring(0, 27) + ((job.error_message?.length || 0) > 27 ? '...' : ''),
          new Date(job.updated_at).toLocaleString()
        ]);
      });

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal: ${jobs.length} job(s) in DLQ`));
    } catch (error) {
      console.error(chalk.red('✗ Failed to list DLQ:'), error);
      process.exit(1);
    }
  });

dlqCmd
  .command('retry')
  .description('Retry a job from Dead Letter Queue')
  .argument('<job-id>', 'Job ID to retry')
  .action(async (jobId: string) => {
    try {
      const queueManager = new QueueManager(DATA_DIR);
      const success = await queueManager.retryDeadJob(jobId);

      if (success) {
        console.log(chalk.green('✓ Job moved back to queue'));
      } else {
        console.log(chalk.yellow('Job not found in DLQ or already retried'));
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to retry job:'), error);
      process.exit(1);
    }
  });

/**
 * Config commands
 */
const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('get')
  .description('Get configuration value')
  .argument('[key]', 'Configuration key')
  .action(async (key?: string) => {
    try {
      const queueManager = new QueueManager(DATA_DIR);
      const configManager = queueManager.getConfigManager();

      if (key) {
        const value = configManager.get(key as any);
        console.log(`${key}: ${value}`);
      } else {
        const all = configManager.getAll();
        const table = new Table({
          head: [chalk.cyan('Key'), chalk.cyan('Value')],
          style: { head: [], border: [] }
        });

        all.forEach(({ key, value }) => {
          table.push([key, value.toString()]);
        });

        console.log(table.toString());
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to get config:'), error);
      process.exit(1);
    }
  });

configCmd
  .command('set')
  .description('Set configuration value')
  .argument('<key>', 'Configuration key')
  .argument('<value>', 'Configuration value')
  .action(async (key: string, value: string) => {
    try {
      const queueManager = new QueueManager(DATA_DIR);
      const configManager = queueManager.getConfigManager();
      
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        throw new Error('Value must be a number');
      }

      configManager.set(key as any, numValue);
      console.log(chalk.green(`✓ Set ${key} = ${numValue}`));
    } catch (error) {
      console.error(chalk.red('✗ Failed to set config:'), error);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
