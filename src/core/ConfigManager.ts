import * as fs from 'fs';
import * as path from 'path';
import { QueueConfig } from '../types';

/**
 * Configuration manager for queue system
 * Persists configuration to disk
 */
export class ConfigManager {
  private configFile: string;
  private config: QueueConfig;

  private static readonly DEFAULT_CONFIG: QueueConfig = {
    max_retries: 3,
    backoff_base: 2,
    worker_poll_interval: 1000,
    graceful_shutdown_timeout: 30000
  };

  constructor(dataDir: string = './data') {
    this.configFile = path.join(path.resolve(dataDir), 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or use defaults
   */
  private loadConfig(): QueueConfig {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf-8');
        return { ...ConfigManager.DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
    }
    return { ...ConfigManager.DEFAULT_CONFIG };
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * Set a configuration value
   */
  set(key: keyof QueueConfig, value: number): void {
    if (typeof value !== 'number' || value < 0) {
      throw new Error(`Invalid value for ${key}: must be a positive number`);
    }

    this.config[key] = value;
    this.saveConfig();
  }

  /**
   * Get a specific configuration value
   */
  get(key: keyof QueueConfig): number {
    return this.config[key];
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = { ...ConfigManager.DEFAULT_CONFIG };
    this.saveConfig();
  }

  /**
   * Get all configuration as key-value pairs
   */
  getAll(): Array<{ key: string; value: number }> {
    return Object.entries(this.config).map(([key, value]) => ({
      key,
      value
    }));
  }
}
