# QueueCTL Quick Start Guide

Get up and running with QueueCTL in 5 minutes!

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Optional: Link for global usage
npm link
```

## Your First Job

### 1. Enqueue a Simple Job

```bash
queuectl enqueue "echo 'Hello, QueueCTL!'"
```

**Output:**
```
✓ Job enqueued successfully
Job ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Command: echo 'Hello, QueueCTL!'
Max Retries: 3
```

### 2. Check Queue Status

```bash
queuectl status
```

**Output:**
```
📊 Queue Status

┌─────────────────────┬───────┐
│ State               │ Count │
├─────────────────────┼───────┤
│ Pending             │ 1     │
│ Processing          │ 0     │
│ Completed           │ 0     │
│ Failed (Retrying)   │ 0     │
│ Dead (DLQ)          │ 0     │
└─────────────────────┴───────┘

Total Jobs: 1
```

### 3. Start a Worker

```bash
queuectl worker start
```

**Output:**
```
Reset 0 stuck job(s) from previous run
Started 1 worker(s)
Press Ctrl+C to stop workers gracefully
```

The worker will process your job and you'll see it complete. Press `Ctrl+C` to stop the worker.

### 4. Verify Completion

```bash
queuectl list --state completed
```

## Common Workflows

### Workflow 1: Process Multiple Jobs

```bash
# Enqueue several jobs
queuectl enqueue "echo 'Job 1'"
queuectl enqueue "echo 'Job 2'"
queuectl enqueue "echo 'Job 3'"

# Start multiple workers
queuectl worker start --count 2

# Watch them process (Ctrl+C when done)
```

### Workflow 2: Handle Failures

```bash
# Enqueue a job that will fail
queuectl enqueue "exit 1"

# Start worker
queuectl worker start

# Watch it retry with exponential backoff
# After 3 retries, it moves to Dead Letter Queue

# Check DLQ
queuectl dlq list

# Retry the failed job
queuectl dlq retry <job-id>
```

### Workflow 3: Configure Retry Behavior

```bash
# View current configuration
queuectl config get

# Set max retries to 5
queuectl config set max_retries 5

# Set backoff base to 3 (3^1=3s, 3^2=9s, 3^3=27s)
queuectl config set backoff_base 3

# Verify changes
queuectl config get
```

## Real-World Examples

### Example 1: Backup Script

```bash
# Enqueue a database backup
queuectl enqueue "pg_dump mydb > backup_$(date +%Y%m%d).sql"

# Start worker
queuectl worker start
```

### Example 2: Image Processing

```bash
# Process multiple images
for file in *.jpg; do
  queuectl enqueue "convert $file -resize 800x600 thumb_$file"
done

# Start 4 workers for parallel processing
queuectl worker start --count 4
```

### Example 3: API Calls

```bash
# Send webhooks
queuectl enqueue "curl -X POST https://api.example.com/webhook -d '{\"event\":\"user.signup\"}'"

# Start worker
queuectl worker start
```

## Testing Your Setup

Run the automated test suite:

```bash
# On Windows
.\test-scenarios.ps1

# On Linux/Mac
chmod +x test-scenarios.sh
./test-scenarios.sh
```

## Command Reference

| Command | Description |
|---------|-------------|
| `enqueue <command>` | Add job to queue |
| `worker start [--count N]` | Start N workers |
| `worker stop` | Stop all workers |
| `status` | Show queue statistics |
| `list [--state STATE]` | List jobs |
| `dlq list` | List dead jobs |
| `dlq retry <id>` | Retry dead job |
| `config get [key]` | View configuration |
| `config set <key> <value>` | Update configuration |

## Tips & Tricks

### 1. Global Installation

```bash
npm link
# Now use 'queuectl' instead of 'node dist/cli.js'
queuectl enqueue "echo 'Hello!'"
```

### 2. Environment Variable

```bash
# Change data directory
export QUEUECTL_DATA_DIR=/path/to/data
queuectl enqueue "echo 'test'"
```

### 3. Background Workers

```bash
# On Linux/Mac
nohup queuectl worker start --count 3 > worker.log 2>&1 &

# On Windows (PowerShell)
Start-Job { queuectl worker start --count 3 }
```

### 4. Monitor in Real-Time

```bash
# Watch queue status
watch -n 2 'queuectl status'

# Or on Windows
while ($true) { cls; queuectl status; Start-Sleep 2 }
```

## Troubleshooting

### Workers Won't Start

```bash
# Remove stale PID file
rm data/workers.pid

# Try again
queuectl worker start
```

### Jobs Stuck in Processing

```bash
# Workers auto-reset stuck jobs on start
queuectl worker start
```

### Permission Errors

```bash
# Ensure data directory is writable
chmod -R 755 data/
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for design details
- Explore the source code in `src/`
- Customize configuration for your use case

## Need Help?

- Check the [README.md](README.md) for comprehensive documentation
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- Open an issue on GitHub

---

**Happy Queueing! 🚀**
