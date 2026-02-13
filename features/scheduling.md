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

The scheduler automatically detects and cleans up "zombie" DAG runs - processes marked as running but no longer alive (e.g., due to system crashes or force kills):

```yaml
# config.yaml
scheduler:
  zombieDetectionInterval: 45s  # Check interval (default: 45s, set to 0 to disable)
```

When a zombie is detected, its status is automatically updated from "running" to "failed". This ensures:
- Accurate status reporting
- Queue slots are freed for new runs
- No manual intervention required

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

restartWaitSec: 60  # Wait 60s before restart
```

## Skip Redundant Runs

Prevent overlapping executions:

```yaml
schedule: "*/5 * * * *"  # Every 5 minutes
skipIfSuccessful: true   # Skip if last run succeeded

steps:
  - command: echo "Checking status"
```

## Catchup (Missed Run Replay)

When the scheduler restarts after downtime, it can replay missed cron runs. Set `catchupWindow` to enable this.

```yaml
schedule: "0 * * * *"
catchupWindow: "6h"

steps:
  - command: ./hourly-job.sh
```

If the scheduler was down from 10:00 to 14:00 and restarts at 14:00, it replays the 10:00, 11:00, 12:00, 13:00, and 14:00 runs in chronological order, one per scheduler tick (one tick per minute).

### How the replay start time is computed

The scheduler replays from the **latest** of these three values:
- `now - catchupWindow`
- The last global tick (when the scheduler last processed any tick)
- The last time this specific DAG was scheduled (per-DAG watermark)

Source: `ComputeReplayFrom()` in `internal/service/scheduler/catchup.go`.

### Duration syntax

`catchupWindow` accepts Go `time.ParseDuration` syntax plus `d` for days:

| Example | Duration |
|---------|----------|
| `"30m"` | 30 minutes |
| `"6h"` | 6 hours |
| `"2d12h"` | 2 days 12 hours |
| `"1d"` | 24 hours |

The value must be positive. An empty or zero value disables catchup.

### Overlap during catchup

`overlapPolicy` controls what happens when a catchup run is ready but the DAG is still running from a previous catchup run:

```yaml
schedule: "0 * * * *"
catchupWindow: "6h"
overlapPolicy: "skip"

steps:
  - command: ./slow-job.sh
```

| Value | Behavior |
|-------|----------|
| `"skip"` (default) | Drop the catchup run and advance to the next one in the buffer |
| `"all"` | Keep the run in the buffer, retry on the next scheduler tick |
| `"latest"` | Discard all but the most recent missed interval, dispatch only the newest |

`overlapPolicy` only affects catchup runs. Live scheduled runs use different guards (isRunning check, alreadyFinished check, `skipIfSuccessful`).

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
      maxConcurrency: 2  # Allow 2 concurrent instances
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
disableQueue: true  # Skip queue, run immediately
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
