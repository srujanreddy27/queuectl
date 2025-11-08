import { spawn } from 'child_process';
import { JobResult } from '../types';

/**
 * Executes shell commands for jobs
 */
export class JobExecutor {
  /**
   * Execute a command and return the result
   */
  async execute(command: string, timeout: number = 300000): Promise<JobResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Parse command for shell execution
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/sh';
      const shellFlag = isWindows ? '/c' : '-c';

      const child = spawn(shell, [shellFlag, command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      // Set timeout
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // Capture stdout
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Capture stderr
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process exit
      child.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          resolve({
            success: false,
            error: `Command timed out after ${timeout}ms`,
            exit_code: -1
          });
          return;
        }

        const success = code === 0;
        resolve({
          success,
          output: stdout.trim(),
          error: stderr.trim() || (success ? undefined : `Command exited with code ${code}`),
          exit_code: code || 0
        });
      });

      // Handle spawn errors
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: `Failed to execute command: ${error.message}`,
          exit_code: -1
        });
      });
    });
  }

  /**
   * Validate if a command is safe to execute
   * Basic validation - can be extended
   */
  validateCommand(command: string): { valid: boolean; error?: string } {
    if (!command || command.trim().length === 0) {
      return { valid: false, error: 'Command cannot be empty' };
    }

    // Check for extremely long commands
    if (command.length > 10000) {
      return { valid: false, error: 'Command is too long' };
    }

    return { valid: true };
  }
}
