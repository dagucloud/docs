# Scheduling

Automate workflow execution with cron-based scheduling.

## Prerequisites

Start the scheduler process:

```bash
dagu scheduler
```

Or use `dagu start-all` to run both scheduler and web server.

### High Availability

Dagu supports running multiple scheduler instances for high availability with automatic failover:

```bash
# Start primary scheduler
dagu scheduler

# Start standby schedulers (on other machines)
dagu scheduler  # Will wait for lock and take over if primary fails
```

The scheduler uses directory-based locking to ensure only one instance is active at a time. When the primary scheduler fails, a standby automatically takes over within 30 seconds.

The first scheduler updates the lock file every 7 seconds to ensure it remains the active instance, tolerating 4 missed updates before considering the lock stale. This allows a standby scheduler to take over if the primary fails.

### Health Check Monitoring

The scheduler provides an optional HTTP health check endpoint for monitoring:

```yaml
# config.yaml
scheduler:
  port: 8090  # Health check port (set to 0 to disable)
```

When enabled, access the health endpoint at `http://localhost:8090/health`.

**Note**: The health check only runs when using `dagu scheduler` directly, not with `dagu start-all`.

### Zombie Detection

The scheduler detects and cleans up "zombie" DAG runs — processes whose status file says "running" but whose process is no longer alive (e.g., after `kill -9`, system crash, or OOM kill).

#### How it works

Each running DAG process writes an 8-byte binary timestamp to a proc file every `proc.heartbeat_interval` (default: 5s) and fsyncs every `proc.heartbeat_sync_interval` (default: 10s).

A local run is treated as dead when Dagu cannot find any non-stale proc heartbeat file for that run. This is a local heartbeat-based decision, not an OS-level PID lookup.

The zombie detector runs every `scheduler.zombie_detection_interval` (default: 45s) and checks all runs with status "running":

1. Read the proc file timestamp. If `now - timestamp < proc.stale_threshold`, the run is alive, so skip it.
2. If stale, increment a per-run counter. If the counter is below `scheduler.failure_threshold` (default: 3), wait for the next cycle.
3. After `scheduler.failure_threshold` consecutive stale checks, re-read the run's status. If it is still active (running/queued/waiting), write status "failed". If the run already completed (succeeded/cancelled/failed), do nothing.
4. Independent of the background detector, status reads also repair verified stale local runs immediately once no fresh local proc heartbeat remains, so `dagu server` and direct CLI execution do not leave runs stuck in `running`.

With defaults, a truly dead process is detected by the background scheduler in at most `scheduler.failure_threshold × scheduler.zombie_detection_interval` = 3 × 45s = **135 seconds**. A transiently stale process (GC pause, I/O lag) survives as long as it recovers within that window.

That 135-second worst case applies to the background scheduler detector only. `dagu server` and direct CLI status reads can repair sooner because they do not wait for `scheduler.failure_threshold` once the local proc heartbeat is already stale.

If a heartbeat file is deleted externally while the process is still alive, the heartbeat goroutine detects the missing file and recreates it on the next tick.

#### Configuration

```yaml
# config.yaml
proc:
  heartbeat_interval: "5s"           # Process heartbeat write interval (default: 5s)
  heartbeat_sync_interval: "10s"     # Heartbeat fsync interval (default: 10s)
  stale_threshold: "90s"             # Heartbeat age to be considered stale (default: 90s)

scheduler:
  zombie_detection_interval: "45s"   # How often the detector scans (default: 45s, "0" to disable)
  failure_threshold: 3               # Consecutive stale checks before kill (default: 3)
```

The timing invariant: `proc.stale_threshold` should be significantly larger than `proc.heartbeat_sync_interval` to avoid false positives. With defaults, the margin is 80s (90s - 10s).

Legacy compatibility: `scheduler.heartbeat_interval`, `scheduler.heartbeat_sync_interval`, and `scheduler.stale_threshold` are still accepted as deprecated aliases for `proc.*`. If both are set, `proc.*` wins.

#### Example: tuning for faster detection

To detect dead processes in ~30 seconds at the cost of more frequent disk writes:

```yaml
proc:
  heartbeat_interval: "2s"
  heartbeat_sync_interval: "4s"
  stale_threshold: "20s"

scheduler:
  zombie_detection_interval: "10s"
  failure_threshold: 3
```

Worst-case detection: 3 × 10s = 30s. Heartbeat writes: one 8-byte write every 2s per running DAG.

#### Distributed mode

Zombie detection for distributed runs (runs with a `worker_id`) is handled by the coordinator via worker heartbeats, not by the scheduler's zombie detector. The scheduler and local status-read repair paths skip any run where `worker_id` is set and is not `"local"`.

## Basic Scheduling

Schedule workflows with cron expressions:

```yaml
schedule: "0 2 * * *"  # Daily at 2 AM
steps:
  - command: echo "Processing scheduled task"
```

## Multiple Schedules

Run at different times:

```yaml
schedule:
  - "0 9 * * MON-FRI"   # Weekdays at 9 AM
  - "0 14 * * SAT,SUN"  # Weekends at 2 PM
steps:
  - command: echo "Running job"
```

## Timezone Support

Specify timezone with `CRON_TZ`:

```yaml
schedule: "CRON_TZ=Asia/Tokyo 0 9 * * *"  # 9 AM Tokyo time
```

See [tz database timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) for valid values.

## Start/Stop Schedules

Control long-running processes:

```yaml
schedule:
  start: "0 8 * * *"   # Start at 8 AM
  stop: "0 18 * * *"   # Stop at 6 PM
steps:
  - command: echo "Running service"
```

Multiple start/stop times:

```yaml
schedule:
  start:
    - "0 0 * * *"    # Midnight
    - "0 12 * * *"   # Noon
  stop:
    - "0 6 * * *"    # 6 AM
    - "0 18 * * *"   # 6 PM
```

## Restart Schedule

Restart workflows periodically:

```yaml
schedule:
  start: "0 8 * * *"     # Start at 8 AM
  restart: "0 12 * * *"  # Restart at noon
  stop: "0 18 * * *"     # Stop at 6 PM

restart_wait_sec: 60  # Wait 60s before restart
```

## Skip Redundant Runs

Prevent overlapping executions:

```yaml
schedule: "*/5 * * * *"  # Every 5 minutes
skip_if_successful: true   # Skip if last run succeeded

steps:
  - command: echo "Checking status"
```

## Catchup (Missed Run Replay)

When the scheduler restarts after downtime, it can replay missed cron runs. Catchup requires two things:

1. `catchup_window` set on the DAG
2. `queues.enabled: true` in `config.yaml`

```yaml
# ~/.config/dagu/config.yaml
queues:
  enabled: true
```

```yaml
# DAG file
schedule: "0 * * * *"
catchup_window: "6h"

steps:
  - command: ./hourly-job.sh
```

If the scheduler was down from 10:00 to 14:00 and restarts at 14:00, it replays the 10:00, 11:00, 12:00, 13:00, and 14:00 runs in chronological order, one per scheduler tick (one tick per minute).

If `queues.enabled` is `false`, the scheduler logs a warning per DAG that has `catchup_window` set and skips catchup entirely.

### Dispatch via enqueue

Catchup runs are dispatched through the queue system, not started directly. For each missed interval, the scheduler:

1. Generates a deterministic run ID from the DAG name and scheduled time
2. Checks if a run with that ID already exists (`FindAttempt`) — if so, skips it
3. Creates a run record with status `Queued`
4. Adds the item to the queue store

The queue processor then picks up the item and executes it. This works for both local and distributed execution modes — the queue processor calls `ExecuteDAG()` which routes to the coordinator for distributed DAGs.

If enqueueing fails after the run record is created, the record is rolled back (`RemoveDAGRun`) and the watermark is not advanced, so the interval is retried on the next scheduler tick or restart.

### Deterministic run IDs

Catchup run IDs follow the format:

```
catchup-{name}-{hash}-{timestamp}
```

- `{name}` — DAG name with dots replaced by underscores, truncated to 31 characters if needed
- `{hash}` — first 8 hex characters of the SHA-256 hash of the original DAG name
- `{timestamp}` — scheduled time in UTC as `20060102T150405`

Example: a DAG named `etl-pipeline` with a missed run at 2026-03-12 14:00 UTC produces:

```
catchup-etl-pipeline-b763ab2e-20260312T140000
```

The hash ensures that DAGs with names that differ only in dots vs underscores (e.g., `my.dag` and `my_dag`) produce different run IDs. The deterministic format means the same missed interval always produces the same ID, which is what makes catchup idempotent across restarts.

### Idempotency on restart

When the scheduler restarts, it recomputes missed intervals from the watermark. If an interval was already enqueued (the run ID exists in the store), it is skipped. The watermark is re-advanced. No duplicate run is created.

The watermark advances after successful enqueue, not after execution. If the scheduler crashes between enqueue and watermark persistence, the interval is recomputed on restart, found via `FindAttempt`, and skipped.

### How the replay start time is computed

The scheduler replays from the **latest** of these three values:
- `now - catchup_window`
- The last global tick (when the scheduler last processed any tick)
- The last time this specific DAG was scheduled (per-DAG watermark)

Source: `ComputeReplayFrom()` in `internal/service/scheduler/catchup.go`.

### Duration syntax

`catchup_window` accepts Go `time.ParseDuration` syntax plus `d` for days:

| Example | Duration |
|---------|----------|
| `"30m"` | 30 minutes |
| `"6h"` | 6 hours |
| `"2d12h"` | 2 days 12 hours |
| `"1d"` | 24 hours |

The value must be positive. An empty or zero value disables catchup.

### Overlap during catchup

`overlap_policy` controls what happens when a catchup run is ready but the DAG is still running or queued:

```yaml
schedule: "0 * * * *"
catchup_window: "6h"
overlap_policy: "skip"

steps:
  - command: ./slow-job.sh
```

| Value | Behavior |
|-------|----------|
| `"skip"` (default) | Drop the catchup run and advance to the next one in the buffer |
| `"all"` | Keep the run in the buffer, retry on the next scheduler tick |
| `"latest"` | Discard all but the most recent missed interval, dispatch only the newest |

The overlap check considers both `Running` and `Queued` states. For the `skip` policy, if the DAG has any run currently running or queued, the catchup run is dropped. Without this, multiple catchup runs could queue up before any starts executing, defeating the purpose of `skip`.

Live scheduled runs are also blocked while a catchup run is queued for the same DAG.

### Catchup buffer limit

At most 1000 missed runs are buffered per DAG. If more than 1000 runs were missed, only the 1000 most recent are replayed.

## Queue Management

Control concurrent executions using global queues:

```yaml
# ~/.config/dagu/config.yaml
queues:
  enabled: true
  config:
    - name: batch-jobs
      max_concurrency: 2  # Allow 2 concurrent instances
```

```yaml
# In your DAG file
queue: batch-jobs  # Assign to queue for concurrency control

schedule: "*/10 * * * *"
steps:
  - command: echo "Running batch process"
```

When no `queue` is specified, DAGs use a local queue with FIFO processing (concurrency of 1).

Disable queue processing:

```yaml
disable_queue: true  # Skip queue, run immediately
```

## Common Patterns

### Business Hours Only
```yaml
schedule: "*/30 8-17 * * MON-FRI"  # Every 30 min, 8AM-5PM weekdays
```

### End of Month
```yaml
schedule: "0 23 28-31 * *"  # 11 PM on last days of month
preconditions:
  - condition: '[ $(date +%d -d tomorrow) -eq 1 ]'
    expected: "true"
```

### Maintenance Windows
```yaml
schedule:
  start: "0 2 * * SAT"   # Saturday 2 AM
  stop: "0 4 * * SAT"    # Saturday 4 AM
```
