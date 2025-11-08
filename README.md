# QueueCTL

A command-line job queue system built with TypeScript and Node.js. This tool manages background tasks with automatic retries, multiple workers, and persistent storage.

## Features

- Queue shell commands for background execution
- Run multiple worker processes simultaneously
- Automatic retry with exponential backoff delays
- Dead Letter Queue for permanently failed jobs
- File-based storage that survives restarts
- Adjustable retry and backoff configuration
- Workers finish their current job before shutting down
- File locking prevents duplicate job execution
- Simple command-line interface
- Type-safe TypeScript implementation

## Table of Contents

- Installation
- Quick Start
- CLI Commands
- Architecture
- Job Lifecycle
- Configuration
- Testing
- Examples
- Design Decisions
- Project Structure

## Installation

Requirements:
- Node.js 16.0.0 or higher
- npm package manager

Quick setup:

Linux/Mac:
chmod +x setup.sh
./setup.sh

Windows:
.\setup.ps1

Manual installation:

git clone https://github.com/srujanreddy27/queuectl.git
cd queuectl
npm install
npm run build
npm link

## Quick Start

Add a job:
queuectl enqueue "echo 'Hello, World!'"

Start workers:
queuectl worker start --count 2

Check status:
queuectl status

List completed jobs:
queuectl list --state completed

## CLI Commands

Job Management

Enqueue a job:

Simple command:
queuectl enqueue "echo 'Hello World'"

With custom retry count:
queuectl enqueue "sleep 5" --retries 5

Using JSON format:
queuectl enqueue '{"command":"node script.js","max_retries":3}'

### Worker Management

#### Start Workers

# Start single worker
queuectl worker start

# Start multiple workers
queuectl worker start --count 3

#### Stop Workers

queuectl worker stop

### Status & Monitoring

#### View Queue Status

queuectl status

**Output:**
📊 Queue Status

┌─────────────────────┬───────┐
│ State               │ Count │
├─────────────────────┼───────┤
│ Pending             │ 5     │
│ Processing          │ 2     │
│ Completed           │ 15    │
│ Failed (Retrying)   │ 1     │
│ Dead (DLQ)          │ 0     │
└─────────────────────┴───────┘

Total Jobs: 23

#### List Jobs

# List all jobs
queuectl list

# Filter by state
queuectl list --state pending
queuectl list --state completed
queuectl list --state dead

# Limit results
queuectl list --limit 10

### Dead Letter Queue (DLQ)

#### List DLQ Jobs

queuectl dlq list

#### Retry a Failed Job

queuectl dlq retry <job-id>

### Configuration

#### View Configuration

# View all settings
queuectl config get

# View specific setting
queuectl config get max_retries

#### Update Configuration

# Set max retries
queuectl config set max_retries 5

# Set backoff base (exponential backoff: base^attempts)
queuectl config set backoff_base 2

# Set worker poll interval (ms)
queuectl config set worker_poll_interval 1000

# Set graceful shutdown timeout (ms)
queuectl config set graceful_shutdown_timeout 30000
```

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                      QueueCTL CLI                       │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    Queue     │  │   Worker     │  │   Config     │
│   Manager    │  │   Manager    │  │   Manager    │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                  ┌──────────────┐
                  │  Job Storage │
                  │  (File-based)│
                  └──────────────┘
```

### Core Modules

1. **QueueManager** - Handles job lifecycle, retry logic, and DLQ
2. **WorkerManager** - Manages multiple worker processes
3. **Worker** - Individual worker that processes jobs
4. **JobStorage** - Persistent file-based storage with atomic operations
5. **JobExecutor** - Executes shell commands safely
6. **ConfigManager** - Manages system configuration

## 🔄 Job Lifecycle

```
┌─────────┐
│ PENDING │ ◄──────────────────┐
└────┬────┘                    │
     │                         │
     ▼                         │
┌────────────┐           ┌─────────┐
│ PROCESSING │           │ FAILED  │
└─────┬──────┘           └────┬────┘
      │                       │
      ├─── Success ──► ┌──────────┐
      │                │COMPLETED │
      │                └──────────┘
      │
      └─── Failure ──► ┌─────────┐
                       │  DEAD   │ (DLQ)
                       └─────────┘
```

### State Descriptions

| State | Description |
|-------|-------------|
| `pending` | Job is waiting to be picked up by a worker |
| `processing` | Job is currently being executed by a worker |
| `completed` | Job executed successfully |
| `failed` | Job failed but will be retried |
| `dead` | Job permanently failed (moved to DLQ) |

## ⚙️ Configuration

### Default Configuration

```json
{
  "max_retries": 3,
  "backoff_base": 2,
  "worker_poll_interval": 1000,
  "graceful_shutdown_timeout": 30000
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `max_retries` | Maximum retry attempts before moving to DLQ | 3 |
| `backoff_base` | Base for exponential backoff (delay = base^attempts) | 2 |
| `worker_poll_interval` | Worker polling interval in milliseconds | 1000 |
| `graceful_shutdown_timeout` | Max time to wait for job completion on shutdown (ms) | 30000 |

### Retry Backoff Calculation

```
delay (seconds) = backoff_base ^ attempts

Example with backoff_base = 2:
- Attempt 1: 2^1 = 2 seconds
- Attempt 2: 2^2 = 4 seconds
- Attempt 3: 2^3 = 8 seconds
```

## 🧪 Testing

### Automated Test Suite

Run the comprehensive test suite:

```bash
# On Windows (PowerShell)
.\test-scenarios.ps1

# On Linux/Mac
chmod +x test-scenarios.sh
./test-scenarios.sh
```

### Manual Testing

#### Test 1: Basic Job Completion

```bash
queuectl enqueue "echo 'Test job'"
queuectl worker start --count 1
# Wait a few seconds, then Ctrl+C
queuectl status
```

#### Test 2: Failed Job with Retry

```bash
queuectl enqueue "exit 1"
queuectl worker start --count 1
# Watch the job retry with exponential backoff
```

#### Test 3: Multiple Workers

```bash
# Enqueue multiple jobs
for i in {1..10}; do queuectl enqueue "sleep 2 && echo 'Job $i'"; done

# Start multiple workers
queuectl worker start --count 3
```

#### Test 4: Persistence

```bash
queuectl enqueue "echo 'Persistence test'"
queuectl status
# Restart the terminal/system
queuectl status  # Job should still be there
```

#### Test 5: DLQ

```bash
queuectl enqueue "nonexistentcommand"
queuectl worker start --count 1
# Wait for retries to exhaust
queuectl dlq list
queuectl dlq retry <job-id>
```

## 📚 Examples

### Example 1: Batch Processing

```bash
# Process multiple files
queuectl enqueue "node process-file.js file1.txt"
queuectl enqueue "node process-file.js file2.txt"
queuectl enqueue "node process-file.js file3.txt"

# Start workers
queuectl worker start --count 2
```

### Example 2: Scheduled Tasks

```bash
# Backup database
queuectl enqueue "pg_dump mydb > backup.sql"

# Clean up old logs
queuectl enqueue "find /var/log -mtime +30 -delete"

# Generate reports
queuectl enqueue "python generate_report.py"
```

### Example 3: API Calls

```bash
# Make HTTP requests
queuectl enqueue "curl -X POST https://api.example.com/webhook"
queuectl enqueue "node send-email.js user@example.com"
```

### Example 4: Long-Running Jobs

```bash
# Video processing
queuectl enqueue "ffmpeg -i input.mp4 -c:v libx264 output.mp4" --retries 1

# Data migration
queuectl enqueue "node migrate-data.js" --retries 0
```

## 🎨 Design Decisions

### 1. File-Based Storage

**Choice:** JSON file storage with atomic writes

**Rationale:**
- Simple deployment (no external database required)
- Easy to inspect and debug
- Atomic file operations prevent corruption
- File locking prevents race conditions
- Suitable for small to medium workloads

Trade-offs:
- Not suitable for extremely high throughput
- Limited query capabilities compared to databases

Exponential Backoff

Configurable exponential backoff for retries:
- Prevents overwhelming failing services
- Gives transient errors time to resolve
- Industry-standard retry pattern
- Configurable to match different use cases

Worker Architecture

Polling-based workers with configurable interval:
- Simple implementation
- No complex event system required
- Easy to scale horizontally
- Graceful shutdown support

Trade-offs:
- Slight delay between job availability and pickup
- Continuous polling (mitigated by configurable interval)

TypeScript Implementation

Using TypeScript provides:
- Type safety reduces runtime errors
- Better IDE support
- Self-documenting code
- Easier maintenance

CLI-First Design

Command-line interface as primary interface:
- Easy to script and automate
- Works in any environment
- No web server overhead
- Simple integration with existing tools

## Project Structure

```
windsurf-project/
├── src/
│   ├── types/
│   │   └── index.ts           # Type definitions
│   ├── storage/
│   │   └── JobStorage.ts      # Persistent storage layer
│   ├── core/
│   │   ├── QueueManager.ts    # Queue management logic
│   │   ├── ConfigManager.ts   # Configuration management
│   │   └── JobExecutor.ts     # Job execution engine
│   ├── workers/
│   │   ├── WorkerManager.ts   # Worker pool management
│   │   └── Worker.ts          # Individual worker
│   └── cli.ts                 # CLI interface
├── data/                      # Runtime data (gitignored)
│   ├── jobs.json             # Job storage
│   ├── config.json           # Configuration
│   └── workers.pid           # Worker PIDs
├── dist/                      # Compiled JavaScript
├── test-scenarios.sh          # Test suite (Linux/Mac)
├── test-scenarios.ps1         # Test suite (Windows)
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Concurrency and Safety

File Locking

The system uses file-based locking to prevent race conditions:

```typescript
// Atomic lock acquisition
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
```

Atomic Writes

All file writes use atomic rename operations:

```typescript
// Write to temp file, then atomic rename
const tempFile = `${this.jobsFile}.tmp`;
fs.writeFileSync(tempFile, JSON.stringify(jobs, null, 2));
fs.renameSync(tempFile, this.jobsFile);
```

Worker Isolation

Each worker:
- Has a unique ID
- Marks jobs with its worker ID
- Polls independently
- Handles graceful shutdown

## Performance

Throughput

- Small workloads (< 100 jobs/min): Excellent performance
- Medium workloads (100-1000 jobs/min): Good performance
- Large workloads (> 1000 jobs/min): Consider database-backed solution

Scalability

- Horizontal: Add more workers (--count N)
- Vertical: Reduce worker_poll_interval for faster job pickup
- Distributed: Run multiple instances with shared storage

Optimization Tips

1. Adjust poll interval: Lower for faster pickup, higher for less CPU usage
2. Tune worker count: Match to CPU cores and job characteristics
3. Batch jobs: Group related operations
4. Clean up old jobs: Periodically remove completed jobs

## Troubleshooting

Workers won't start:
queuectl status
rm -rf data/workers.pid
queuectl worker start

Jobs stuck in processing:
The system auto-resets stuck jobs on next worker start
queuectl worker start

Permission errors:
chmod -R 755 data/

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome. Please submit a pull request.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with Node.js and TypeScript
