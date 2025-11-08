# QueueCTL Architecture & Design

## Overview

QueueCTL is a production-grade job queue system designed with simplicity, reliability, and maintainability in mind. This document explains the architectural decisions, design patterns, and implementation details.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  (Commander.js - Command parsing and routing)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Queue      │ │   Worker     │ │   Config     │
│   Manager    │ │   Manager    │ │   Manager    │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       │         ┌──────┴───────┐        │
       │         │              │        │
       │         ▼              ▼        │
       │   ┌──────────┐   ┌──────────┐  │
       │   │ Worker 1 │   │ Worker N │  │
       │   └────┬─────┘   └────┬─────┘  │
       │        │              │        │
       │        └──────┬───────┘        │
       │               │                │
       │               ▼                │
       │        ┌──────────────┐        │
       │        │     Job      │        │
       │        │   Executor   │        │
       │        └──────────────┘        │
       │                                │
       └────────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │   Job Storage    │
              │  (File System)   │
              └──────────────────┘
```

## Core Components

### 1. Job Storage (`JobStorage.ts`)

**Responsibility:** Persistent storage and retrieval of jobs

**Key Features:**
- File-based JSON storage
- Atomic write operations using temp files + rename
- File locking to prevent race conditions
- CRUD operations for jobs
- Query capabilities (by state, FIFO ordering)

**Design Patterns:**
- **Repository Pattern**: Abstracts data access
- **Singleton-like**: One instance per data directory
- **Optimistic Locking**: File-based locks with timeout

**Critical Implementation Details:**

```typescript
// Atomic write operation
async writeJobs(jobs: Job[]): Promise<void> {
  await this.acquireLock();
  const tempFile = `${this.jobsFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(jobs, null, 2));
  fs.renameSync(tempFile, this.jobsFile);  // Atomic!
  this.releaseLock();
}
```

**Why File-Based?**
- Zero external dependencies
- Easy to debug (human-readable JSON)
- Sufficient for most use cases
- Simple deployment

**Limitations:**
- Not suitable for > 1000 jobs/second
- Limited concurrent access (file locking)
- No complex queries

### 2. Queue Manager (`QueueManager.ts`)

**Responsibility:** Core business logic for job lifecycle

**Key Features:**
- Job enqueueing with validation
- Job state transitions
- Retry logic with exponential backoff
- Dead Letter Queue management
- Job recovery (stuck jobs)

**State Machine:**

```
PENDING → PROCESSING → COMPLETED
    ↑          ↓
    └─── FAILED ←─┐
           ↓       │
         DEAD      │ (max retries)
           ↓       │
        (DLQ) ─────┘
```

**Retry Algorithm:**

```typescript
const delaySeconds = Math.pow(backoff_base, attempts);
const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
```

**Design Patterns:**
- **Facade Pattern**: Simplifies complex operations
- **Strategy Pattern**: Configurable retry strategies
- **State Pattern**: Job state management

### 3. Worker Manager (`WorkerManager.ts`)

**Responsibility:** Manage worker lifecycle and coordination

**Key Features:**
- Start/stop multiple workers
- Graceful shutdown handling
- Worker statistics tracking
- PID file management
- Signal handling (SIGTERM, SIGINT)

**Worker Pool Management:**

```typescript
// Start N workers
for (let i = 0; i < count; i++) {
  const worker = new Worker(queueManager);
  this.workers.set(worker.getId(), worker);
  worker.start();
}
```

**Graceful Shutdown:**

```typescript
// Wait for all workers to finish current jobs
await Promise.all(
  workers.map(worker => worker.stop())
);
```

**Design Patterns:**
- **Object Pool Pattern**: Worker pool management
- **Observer Pattern**: Signal handling
- **Command Pattern**: Worker operations

### 4. Worker (`Worker.ts`)

**Responsibility:** Individual job processing unit

**Key Features:**
- Polling-based job acquisition
- Job execution
- Error handling
- Statistics tracking
- Graceful shutdown support

**Worker Loop:**

```typescript
private poll(): void {
  this.processNextJob()
    .catch(error => console.error(error))
    .finally(() => {
      if (this.isRunning) {
        setTimeout(() => this.poll(), this.pollInterval);
      }
    });
}
```

**Design Patterns:**
- **Active Object Pattern**: Asynchronous job processing
- **Template Method**: Job processing workflow

### 5. Job Executor (`JobExecutor.ts`)

**Responsibility:** Safe command execution

**Key Features:**
- Cross-platform command execution (Windows/Unix)
- Timeout handling
- Output capture (stdout/stderr)
- Error handling
- Command validation

**Security Considerations:**
- Command length validation
- Timeout enforcement
- Process isolation
- No shell injection (uses spawn with array args)

**Platform Compatibility:**

```typescript
const isWindows = process.platform === 'win32';
const shell = isWindows ? 'cmd.exe' : '/bin/sh';
const shellFlag = isWindows ? '/c' : '-c';
```

### 6. Config Manager (`ConfigManager.ts`)

**Responsibility:** Configuration management

**Key Features:**
- Default configuration
- Persistent configuration storage
- Runtime configuration updates
- Validation

**Configuration Schema:**

```typescript
interface QueueConfig {
  max_retries: number;           // Default: 3
  backoff_base: number;          // Default: 2
  worker_poll_interval: number;  // Default: 1000ms
  graceful_shutdown_timeout: number; // Default: 30000ms
}
```

## Data Flow

### Job Enqueueing Flow

```
User Command
    ↓
CLI Parser
    ↓
QueueManager.enqueue()
    ↓
Validate Command
    ↓
Create Job Object
    ↓
JobStorage.addJob()
    ↓
Acquire Lock
    ↓
Read Jobs
    ↓
Append New Job
    ↓
Atomic Write
    ↓
Release Lock
    ↓
Return Job
```

### Job Processing Flow

```
Worker Poll Loop
    ↓
QueueManager.getNextJob()
    ↓
JobStorage.getNextPendingJob()
    ↓
Filter by State & Retry Time
    ↓
Return Job (FIFO)
    ↓
Worker: Mark as PROCESSING
    ↓
JobExecutor.execute()
    ↓
Spawn Process
    ↓
Capture Output
    ↓
Wait for Completion
    ↓
Success? → COMPLETED
    ↓
Failure? → Check Retry Count
    ↓
Retries Left? → FAILED (schedule retry)
    ↓
No Retries? → DEAD (move to DLQ)
```

## Concurrency & Safety

### File Locking Mechanism

```typescript
// Lock acquisition with timeout
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

**Properties:**
- **Mutual Exclusion**: Only one process can hold lock
- **Timeout**: Prevents deadlocks
- **Process Identification**: Lock file contains PID

### Atomic Operations

All critical operations use atomic file system operations:

1. **Write**: Temp file + atomic rename
2. **Read**: Single read operation
3. **Update**: Read → Modify → Atomic Write

### Race Condition Prevention

**Scenario**: Two workers try to pick the same job

**Solution**:
1. Worker A acquires lock
2. Worker A reads jobs
3. Worker A marks job as PROCESSING
4. Worker A writes jobs atomically
5. Worker A releases lock
6. Worker B acquires lock
7. Worker B reads jobs (job already PROCESSING)
8. Worker B skips that job

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Enqueue | O(n) | Read all jobs, append, write |
| Get Next Job | O(n) | Filter and sort jobs |
| Update Job | O(n) | Find and update job |
| List Jobs | O(n) | Read all jobs |

Where n = total number of jobs

### Space Complexity

- **Memory**: O(n) - All jobs loaded into memory
- **Disk**: O(n) - One JSON file with all jobs

### Bottlenecks

1. **File I/O**: Every operation reads/writes entire file
2. **Lock Contention**: Multiple workers competing for lock
3. **JSON Parsing**: Serialize/deserialize on every operation

### Optimization Strategies

1. **Reduce Lock Duration**: Minimize time holding lock
2. **Batch Operations**: Group multiple updates
3. **Cleanup Old Jobs**: Remove completed jobs periodically
4. **Index in Memory**: Cache job index (future enhancement)

## Scalability

### Horizontal Scaling

**Current**: Multiple workers on single machine

**Future**: Multiple machines with shared storage (NFS, S3, etc.)

### Vertical Scaling

**Current**: Configurable worker count and poll interval

**Optimization**:
- Increase workers for CPU-bound jobs
- Decrease poll interval for faster job pickup
- Increase poll interval to reduce CPU usage

### Limitations

**Current Architecture**:
- Single file storage limits throughput
- File locking limits concurrency
- No distributed coordination

**When to Migrate**:
- > 1000 jobs/second
- > 100 concurrent workers
- Need for distributed processing

## Error Handling

### Error Categories

1. **Validation Errors**: Invalid commands, bad configuration
2. **Storage Errors**: File system issues, lock timeouts
3. **Execution Errors**: Command failures, timeouts
4. **System Errors**: Out of memory, disk full

### Error Recovery

| Error Type | Recovery Strategy |
|------------|------------------|
| Command Failure | Retry with exponential backoff |
| Lock Timeout | Retry lock acquisition |
| Storage Error | Propagate to user |
| Worker Crash | Auto-restart on next worker start |

### Graceful Degradation

- Workers complete current jobs before shutdown
- Stuck jobs auto-reset on next start
- Configuration falls back to defaults
- Missing data directory auto-created

## Testing Strategy

### Unit Tests

- Individual component testing
- Mock dependencies
- Edge case coverage

### Integration Tests

- End-to-end workflows
- Multi-worker scenarios
- Persistence validation

### Test Scenarios

1. ✅ Basic job completion
2. ✅ Failed job retry
3. ✅ Multiple workers without overlap
4. ✅ Invalid command handling
5. ✅ Data persistence across restarts
6. ✅ DLQ functionality
7. ✅ Configuration management
8. ✅ Graceful shutdown

## Security Considerations

### Command Execution

- **No Shell Injection**: Commands executed via spawn
- **Timeout Enforcement**: Prevents runaway processes
- **Process Isolation**: Each job in separate process
- **Resource Limits**: Configurable timeouts

### File System

- **Permission Checks**: Data directory must be writable
- **Path Validation**: Prevent directory traversal
- **Atomic Operations**: Prevent partial writes

### Configuration

- **Validation**: All config values validated
- **Defaults**: Safe default values
- **Bounds Checking**: Prevent invalid values

## Future Enhancements

### Short Term

1. **Job Priority**: Priority queue support
2. **Job Scheduling**: Delayed job execution
3. **Job Timeout**: Per-job timeout configuration
4. **Output Logging**: Persistent job output storage
5. **Metrics**: Job execution statistics

### Long Term

1. **Database Backend**: PostgreSQL/MySQL support
2. **Web Dashboard**: Real-time monitoring UI
3. **Job Dependencies**: Job chaining and workflows
4. **Distributed Workers**: Multi-machine support
5. **Webhooks**: Job completion notifications
6. **Job Cancellation**: Cancel running jobs
7. **Rate Limiting**: Throttle job execution

## Design Principles

### 1. Simplicity

- Minimal dependencies
- Clear separation of concerns
- Easy to understand and modify

### 2. Reliability

- Atomic operations
- Error handling at every level
- Graceful degradation

### 3. Maintainability

- TypeScript for type safety
- Comprehensive documentation
- Consistent code style

### 4. Performance

- Efficient file operations
- Configurable polling
- Minimal memory footprint

### 5. Testability

- Modular design
- Dependency injection
- Comprehensive test coverage

## Conclusion

QueueCTL is designed as a practical, production-ready job queue system that balances simplicity with functionality. The file-based architecture makes it easy to deploy and debug, while the modular design allows for future enhancements and scaling.

The system is suitable for:
- Small to medium workloads
- Development and testing environments
- Microservices with background job needs
- Situations where simplicity is preferred over scale

For high-throughput or distributed scenarios, the architecture can be extended with database backends and distributed coordination systems.
