        # QueueCTL - Demo Script

This script guides you through recording a comprehensive demo of QueueCTL's features.

## 🎬 Demo Recording Guide

### Preparation

1. Clean slate: `rm -rf data/` (or `Remove-Item -Recurse data/` on Windows)
2. Open terminal with good visibility
3. Start screen recording
4. Ensure `npm link` has been run (so `queuectl` command is available)

---

## 📝 Demo Script (5-7 minutes)

### Part 1: Introduction (30 seconds)

```bash
# Show help
queuectl --help

# Show version
queuectl --version
```

**Say**: "QueueCTL is a production-grade job queue system with CLI interface. Let me show you its features."

---

### Part 2: Basic Job Enqueueing (1 minute)

```bash
# Enqueue a simple job
queuectl enqueue "echo 'Hello, QueueCTL!'"

# Enqueue with JSON format
queuectl enqueue '{"command":"echo Job 2","max_retries":5}'

# Check status
queuectl status

# List pending jobs
queuectl list --state pending
```

**Say**: "Jobs can be enqueued using simple commands or JSON format. The status command shows queue statistics."

---

### Part 3: Worker Management (1.5 minutes)

```bash
# Start a single worker
queuectl worker start

# Let it run for 5 seconds, then Ctrl+C

# Check status again
queuectl status

# List completed jobs
queuectl list --state completed
```

**Say**: "Workers process jobs from the queue. Notice the graceful shutdown - the worker finished its current job before stopping."

---

### Part 4: Multiple Workers (1 minute)

```bash
# Enqueue multiple jobs
queuectl enqueue "timeout /t 3"
queuectl enqueue "timeout /t 3"
queuectl enqueue "timeout /t 3"
queuectl enqueue "timeout /t 3"

# Start 2 workers
queuectl worker start --count 2

# Let them run for 10 seconds, then Ctrl+C

# Check final status
queuectl status
```

**Say**: "Multiple workers can process jobs in parallel. File locking ensures no job is processed twice."

---

### Part 5: Retry Mechanism & DLQ (2 minutes)

```bash
# Enqueue a failing job
queuectl enqueue "exit 1"

# Check current config
queuectl config get

# Start worker and watch it retry
queuectl worker start

# Let it retry 3 times (watch the exponential backoff)
# After ~15 seconds (2s + 4s + 8s), Ctrl+C

# Check status - job should be in DLQ
queuectl status

# List dead jobs
queuectl dlq list

# Retry the job from DLQ
queuectl dlq retry <job-id-from-above>

# Verify it's back in pending
queuectl list --state pending
```

**Say**: "Failed jobs retry with exponential backoff. After max retries, they move to the Dead Letter Queue. We can retry them manually."

---

### Part 6: Configuration (1 minute)

```bash
# View all configuration
queuectl config get

# Change max retries
queuectl config set max_retries 5

# Change backoff base
queuectl config set backoff_base 3

# Verify changes
queuectl config get
```

**Say**: "Configuration is fully customizable via CLI and persists across restarts."

---

### Part 7: Persistence Test (1 minute)

```bash
# Enqueue a job
queuectl enqueue "echo 'Persistence test'"

# Show it's pending
queuectl status

# Close and reopen terminal (or just show the same command again)
queuectl status

# List the job
queuectl list --state pending
```

**Say**: "All data persists to disk. Jobs survive system restarts."

---

### Part 8: Advanced Features (30 seconds)

```bash
# Show filtering
queuectl list --state completed --limit 5

# Show help for a command
queuectl worker --help

# Show DLQ help
queuectl dlq --help
```

**Say**: "The CLI provides comprehensive help and filtering options for all commands."

---

## 🎯 Key Points to Highlight

### During Demo

1. **User-Friendly CLI** - Colored output, table formatting
2. **Graceful Shutdown** - Workers finish current jobs
3. **Exponential Backoff** - Watch the retry delays increase
4. **Persistence** - Data survives restarts
5. **Concurrency** - Multiple workers without conflicts
6. **Configuration** - Runtime configuration changes
7. **DLQ Management** - Failed job recovery

### Technical Highlights to Mention

- Built with TypeScript for type safety
- File-based storage with atomic operations
- File locking prevents race conditions
- Cross-platform (Windows, Linux, Mac)
- Zero external dependencies
- Production-ready code quality

---

## 📊 Alternative Demo Flow (Quick Version - 3 minutes)

If time is limited, use this condensed version:

```bash
# 1. Show help
queuectl --help

# 2. Enqueue jobs
queuectl enqueue "echo 'Job 1'"
queuectl enqueue "echo 'Job 2'"
queuectl enqueue "exit 1"  # This will fail

# 3. Check status
queuectl status

# 4. Start workers
queuectl worker start --count 2

# 5. Wait 20 seconds (watch retries), then Ctrl+C

# 6. Show final status
queuectl status

# 7. Show DLQ
queuectl dlq list

# 8. Show configuration
queuectl config get
```

---

## 🎥 Recording Tips

### Before Recording

- [ ] Clean terminal history
- [ ] Remove old data directory
- [ ] Test all commands work
- [ ] Prepare terminal with good font size
- [ ] Close unnecessary applications

### During Recording

- [ ] Speak clearly and at moderate pace
- [ ] Pause briefly after each command output
- [ ] Highlight key features as they appear
- [ ] Show both success and failure scenarios
- [ ] Demonstrate graceful shutdown

### After Recording

- [ ] Trim any mistakes
- [ ] Add captions if needed
- [ ] Upload to Google Drive
- [ ] Set sharing permissions to "Anyone with link"
- [ ] Add link to README.md

---

## 📝 Narration Script

### Opening (10 seconds)

"Hello! I'm demonstrating QueueCTL, a production-grade job queue system built with TypeScript and Node.js. It features worker management, automatic retries with exponential backoff, and a Dead Letter Queue."

### Feature Highlights (Throughout)

- "Notice the colored output and table formatting for better readability."
- "The system uses file-based storage with atomic operations for data integrity."
- "Workers can be started and stopped gracefully - they finish their current job before exiting."
- "Failed jobs automatically retry with exponential backoff - see how the delay increases."
- "After exhausting retries, jobs move to the Dead Letter Queue for manual intervention."
- "All configuration is managed via CLI and persists across restarts."
- "Multiple workers process jobs in parallel without conflicts, thanks to file locking."

### Closing (10 seconds)

"QueueCTL is production-ready, well-documented, and thoroughly tested. All source code, documentation, and test scripts are available in the GitHub repository. Thank you!"

---

## 📋 Post-Demo Checklist

After recording:

- [ ] Video clearly shows all commands
- [ ] Audio is clear and understandable
- [ ] All key features demonstrated
- [ ] Video length is 5-7 minutes (or 3 minutes for quick version)
- [ ] Video uploaded to Google Drive
- [ ] Link added to README.md
- [ ] Sharing permissions set correctly
- [ ] Link tested in incognito mode

---

## 🔗 Adding Video Link to README

Add this section to your README.md:

```markdown
## 🎥 Demo Video

Watch a comprehensive demo of QueueCTL in action:

**[View Demo Video](https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing)**

The demo covers:
- Job enqueueing and management
- Worker lifecycle and parallel processing
- Retry mechanism with exponential backoff
- Dead Letter Queue functionality
- Configuration management
- Data persistence
```

---

## 💡 Tips for a Great Demo

1. **Keep it concise** - Focus on key features
2. **Show real failures** - Demonstrate error handling
3. **Highlight uniqueness** - TypeScript, file locking, graceful shutdown
4. **Be enthusiastic** - Show confidence in your work
5. **End strong** - Summarize key benefits

---

**Good luck with your demo! 🚀**
