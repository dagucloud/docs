# Scheduling

Automate workflow execution with cron schedules, one-off start times, and watched folders.

## Prerequisites

Start the scheduler process:

```bash
dagu scheduler
```

Or use `dagu start-all` to run both scheduler and web server.

### High Availability

Dagu can run standby schedulers that take over automatically when the active scheduler fails. Every scheduler must use the same `DAGU_HOME` on storage that all of them can reach, such as NFS:

```bash
# On each host, with the same DAGU_HOME on shared storage
dagu scheduler  # One instance becomes active; the others wait as standbys
```

The scheduler uses directory-based locking so that one instance is active at a time. When the active scheduler stops cleanly, it releases the lock and a standby takes over within about 5 seconds. When it dies without releasing the lock, a standby takes over once the lock goes stale, usually 23 to 35 seconds later with the default settings, plus the time the new scheduler needs to start.

The active scheduler updates the lock every 7 seconds, and the lock goes stale after 30 seconds without an update.

Runs on a host that failed are marked failed and are not resumed. To run them again automatically, set a DAG-level [`retry_policy`](/writing-workflows/durable-execution) or a [`restart_policy`](/writing-workflows/services).

### Health Check Monitoring

The scheduler provides an optional HTTP health check endpoint for monitoring:

```yaml
# config.yaml
scheduler:
  port: 8090  # Health check port (set to 0 to disable)
```

When enabled, access the health endpoint at `http://localhost:8090/health`.

In high-availability deployments, every scheduler process exposes `/health`, including standby instances that are still waiting on the scheduler lock. Use the system status view or service registry status to distinguish the active scheduler from inactive standbys.

**Note**: The health check only runs when using `dagu scheduler` directly, not with `dagu start-all`.

### Zombie Detection

The scheduler detects and cleans up "zombie" DAG runs: processes whose status file says "running" but whose process is no longer alive (e.g., after `kill -9`, system crash, or OOM kill).

#### How it works

Each running DAG process writes an 8-byte binary timestamp to a proc file every `proc.heartbeat_interval` (default: 5s). Each write goes to a temporary file that is fsynced and then renamed over the proc file, so a reader never sees a partial heartbeat.

A local run is treated as dead when Dagu cannot find any non-stale proc heartbeat file for that run. This is a local heartbeat-based decision, not an OS-level PID lookup.

The zombie detector runs every `scheduler.zombie_detection_interval` (default: 45s) and checks all runs with status "running":

1. Read the proc file timestamp. If `now - timestamp < proc.stale_threshold`, the run is alive, so skip it.
2. If stale, increment a per-run counter. If the counter is below `scheduler.failure_threshold` (default: 3), wait for the next cycle.
3. After `scheduler.failure_threshold` consecutive stale checks, re-read the run's status. If it is still running, write status "failed". If the run is queued or waiting, which needs no process, or has completed (succeeded/cancelled/failed), do nothing.
4. Independent of the background detector, status reads also repair verified stale local runs immediately once no fresh local proc heartbeat remains, so `dagu server` and direct CLI execution do not leave runs stuck in `running`.

With defaults, a truly dead process is detected by the background scheduler in at most `scheduler.failure_threshold × scheduler.zombie_detection_interval` = 3 × 45s = **135 seconds**. A transiently stale process (GC pause, I/O lag) survives as long as it recovers within that window.

That 135-second worst case applies to the background scheduler detector only. `dagu server` and direct CLI status reads can repair sooner because they do not wait for `scheduler.failure_threshold` once the local proc heartbeat is already stale.

If a heartbeat file is deleted externally while the process is still alive, the heartbeat goroutine detects the missing file and recreates it on the next tick.

#### Configuration

```yaml
# config.yaml
proc:
  heartbeat_interval: "5s"           # Process heartbeat write interval (default: 5s)
  stale_threshold: "90s"             # Heartbeat age to be considered stale (default: 90s)

scheduler:
  zombie_detection_interval: "45s"   # How often the detector scans (default: 45s, "0" to disable)
  failure_threshold: 3               # Consecutive stale checks before kill (default: 3)
```

The timing invariant: `proc.stale_threshold` should be significantly larger than `proc.heartbeat_interval` to avoid false positives. Dagu refuses to start when `proc.heartbeat_interval` is not less than `proc.stale_threshold`. With defaults, the margin is 85s (90s - 5s).

Legacy compatibility: `scheduler.heartbeat_interval` and `scheduler.stale_threshold` are still accepted as deprecated aliases for `proc.*`. If both are set, `proc.*` wins.

`proc.heartbeat_sync_interval` and `scheduler.heartbeat_sync_interval` are deprecated and ignored. Dagu still accepts them so existing configuration files load, but the values have no effect. Remove them from your configuration.

#### Example: tuning for faster detection

To detect dead processes in ~30 seconds at the cost of more frequent disk writes:

```yaml
proc:
  heartbeat_interval: "2s"
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
  - run: echo "Processing scheduled task"
```

## Schedule Aliases

Use a quoted alias for a common calendar schedule:

```yaml
type: graph
schedule: "@hourly"
steps:
  - id: report
    run: echo "Processing hourly task"
```

| Alias | Equivalent cron | Runs at |
|-------|-----------------|---------|
| `@hourly` | `0 * * * *` | The start of each hour |
| `@daily` | `0 0 * * *` | Midnight each day |
| `@midnight` | `0 0 * * *` | Midnight each day |
| `@weekly` | `0 0 * * 0` | Midnight on Sunday |
| `@monthly` | `0 0 1 * *` | Midnight on the first day of each month |
| `@yearly` | `0 0 1 1 *` | Midnight on January 1 |
| `@annually` | `0 0 1 1 *` | Midnight on January 1 |

Aliases are case-sensitive and must be quoted in YAML. They work in schedule arrays, `expression` entries, and `start`, `stop`, and `restart` schedules.

Dagu normalizes aliases to the cron expressions above. The API and UI schedule badges show that expression; the YAML editor retains the authored alias. Next-run and catch-up behavior match the equivalent cron schedule.

A `CRON_TZ=` or `TZ=` prefix works with aliases, so `"CRON_TZ=Asia/Tokyo @daily"` runs at midnight in Tokyo.

`@every <duration>`, such as `"@every 90m"`, runs once per interval on a fixed grid aligned to the Unix epoch. The duration must be a positive whole number of minutes, and `@every` does not accept a timezone prefix.

## Multiple Schedules

Run at different times:

```yaml
schedule:
  - "0 9 * * MON-FRI"   # Weekdays at 9 AM
  - "0 14 * * SAT,SUN"  # Weekends at 2 PM
steps:
  - run: echo "Running job"
```

## Profile-Scoped Schedules

Use `profile` when the same DAG file should have different schedules in different environments:

```yaml
schedule:
  - expression: "*/20 * * * *"
    profile: prod
  - expression: "30 */2 * * *"
    profile: dev
steps:
  - run: ./sync-data.sh
```

`profile` is an activation filter. The scheduler evaluates a profile-scoped entry only when it matches the DAG's effective default runtime profile from the server-side DAG settings. Unscoped schedule entries are always active. If the DAG has no default runtime profile, profile-scoped entries are ignored.

The `profile` field does not override the runtime profile used by the run. It only controls whether the schedule entry is active for that scheduler environment.

## Timezone Support

Specify timezone with `CRON_TZ`:

```yaml
schedule: "CRON_TZ=Asia/Tokyo 0 9 * * *"  # 9 AM Tokyo time
```

See [tz database timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) for valid values.

`CRON_TZ` applies only to that schedule and does not set `TZ` in steps. See [Timezone](/server-admin/server#timezone) for the server-wide setting.

## Business Days

Name a [business calendar](/writing-workflows/business-calendars) to skip holidays, and add `business_days` to keep only chosen business days of each month:

```yaml
calendar: weekdays            # built in: Monday to Friday, no holidays
schedule:
  - "0 9 * * *"               # every business day at 09:00
  - expression: "0 18 * * *"
    business_days: [1, -1]    # first and last business day of the month
steps:
  - run: ./report.sh
```

A calendar file in `paths.calendars_dir` adds holidays, shared by every DAG that names it. A fire that falls on a holiday is dropped, not moved. See [Business Calendars](/writing-workflows/business-calendars) for calendar files, previews, and the Calendars page.

## Preview Upcoming Runs

The **Cron** launcher on the workflow canvas lists the next runs of the start schedules, five at first and up to ten, and updates as the YAML changes. Each run reads in the zone of its schedule. With several schedule entries, each run names its entry, and a run placed by a business calendar names the business day it matched or the holidays it skipped.

The list comes from the definition alone. When the DAG is suspended or the scheduler is paused, the launcher says that none of the listed runs will start.

The same list is available as `upcomingRuns` in DAG details, `GET /dags/{fileName}/spec`, and `POST /dags/validate`, and in the MCP `dagu_read` result for a DAG. On the command line, `dagu calendar fires <DAG>` lists the next fires, and `dagu ls -n` shows the scheduler's next run.

## Watched Folders

Start a run for each file that arrives in a folder instead of polling it on a schedule:

```yaml
watch:
  path: ~/Downloads/invoices
  pattern: "*.pdf"     # optional; every file by default
  interval: 30s        # optional; 10s by default
steps:
  - id: count_pages
    run: pdfinfo "$WATCH_FILE"
```

A file counts as arrived once its size and modification time hold still between two readings. Each file runs once, with its path in `WATCH_FILE` and its name in `WATCH_NAME`, and the files already in the folder when the watch starts are left alone. See [Watched Folders](/writing-workflows/watched-folders).

## One-Off Schedules

Use `at` entries when a DAG should run exactly once at a specific timestamp. Dagu accepts them in top-level `schedule` arrays and under `schedule.start`:

```yaml
schedule:
  - at: "2026-03-29T09:30:00+09:00"
steps:
  - run: echo "Run once"
```

Or under `schedule.start`:

```yaml
schedule:
  start:
    - at: "2026-03-29T09:30:00+09:00"
steps:
  - run: echo "Run once"
```

The explicit form is also accepted:

```yaml
schedule:
  start:
    - kind: at
      at: "2026-03-29T09:30:00+09:00"
```

Rules:

- `at` is supported in top-level `schedule` arrays and under `schedule.start`.
- The timestamp must be RFC 3339 with an explicit offset or `Z`.
- Seconds must be `:00`. Minute precision is required.
- Dagu runs that timestamp once and then marks it consumed so it is not dispatched again.

You can mix cron and one-off entries in top-level `schedule` arrays and in `schedule.start`:

```yaml
schedule:
  - "0 9 * * MON-FRI"
  - at: "2026-03-29T09:30:00+09:00"
```

## Start/Stop Schedules

Control long-running processes:

```yaml
schedule:
  start: "0 8 * * *"   # Start at 8 AM
  stop: "0 18 * * *"   # Stop at 6 PM
steps:
  - run: echo "Running service"
```

`stop` and `restart` schedules remain cron-only. One-off `at` entries are rejected there.

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

To keep a DAG running without a schedule, starting a new run whenever one ends, use `restart_policy`. See [Services](/writing-workflows/services).

## Skip Redundant Runs

Skip a scheduled run when the DAG already succeeded since the previous scheduled time, for example after a manual run:

```yaml
schedule: "*/5 * * * *"  # Every 5 minutes
skip_if_successful: true   # Skip if a run succeeded since the previous slot

steps:
  - run: echo "Checking status"
```

## Catchup (Missed Run Replay)

When the scheduler restarts after downtime, it can replay missed cron runs. Catchup requires two things:

1. `catchup_window` set on the DAG
2. Queues enabled in `config.yaml`. `queues.enabled` defaults to `true`.

```yaml
# DAG file
schedule: "0 * * * *"
catchup_window: "6h"

steps:
  - run: ./hourly-job.sh
```

If the scheduler was down from 10:00 to 14:00 and restarts at 14:00, it replays the 10:00, 11:00, 12:00, 13:00, and 14:00 runs in chronological order, one per scheduler tick (one tick per minute).

If `queues.enabled` is `false`, the scheduler logs a warning per DAG that has `catchup_window` set and skips catchup entirely.

### Dispatch via enqueue

Catchup runs are dispatched through the queue system, not started directly. So
are the scheduled runs of a DAG assigned to a queue defined in `config.yaml`,
whether the DAG names that queue itself or inherits it from `base.yaml`. For each missed interval, the scheduler:

1. Generates a deterministic run ID from the DAG name and scheduled time
2. Checks if a run with that ID already exists (`FindAttempt`): if so, skips it
3. Creates a run record with status `Queued`
4. Adds the item to the queue store

The queue processor then picks up the item and executes it. This works for both local and distributed execution modes: the queue processor calls `ExecuteDAG()`, which routes to the coordinator for distributed DAGs.

If enqueueing fails after the run record is created, the record is rolled back (`RemoveDAGRun`) and the watermark is not advanced, so the interval is retried on the next scheduler tick or restart.

### Deterministic run IDs

Catchup run IDs follow the format:

```
catchup-{hash}-{timestamp}
```

- `{hash}`: first 12 hex characters of the SHA-256 hash of the DAG name
- `{timestamp}`: scheduled time in UTC as `20060102T150405`

Example: a DAG named `etl-pipeline` with a missed run at 2026-03-12 14:00 UTC produces:

```
catchup-b763ab2e276d-20260312T140000
```

The deterministic format means the same missed interval always produces the same ID, which is what makes catchup idempotent across restarts. Before enqueueing, the scheduler also checks for an ID in the older `catchup-{name}-{8-hex hash}-{timestamp}` format, so an interval enqueued by an earlier version is not replayed twice.

### Idempotency on restart

When the scheduler restarts, it recomputes missed intervals from the watermark. If an interval was already enqueued (the run ID exists in the store), it is skipped. The watermark is re-advanced. No duplicate run is created.

The watermark advances after successful enqueue, not after execution. If the scheduler crashes between enqueue and watermark persistence, the interval is recomputed on restart, found via `FindAttempt`, and skipped.

### How the replay start time is computed

The scheduler replays from the **latest** of these three values:
- `now - catchup_window`
- The last global tick (when the scheduler last processed any tick)
- The last time this specific DAG was scheduled (per-DAG watermark)

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
  - run: ./slow-job.sh
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

## Pausing the Scheduler

Suspending a single DAG stops that DAG only. To freeze every scheduled run at once, for a maintenance window or an incident, pause the scheduler.

Pause and resume from **System Status** in the web UI, or through the API:

```bash
# Pause
curl -X POST "http://localhost:8080/api/v1/services/scheduler/pause" \
     -H "Authorization: Bearer $DAGU_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"paused": true, "reason": "database migration"}'

# Resume
curl -X POST "http://localhost:8080/api/v1/services/scheduler/pause" \
     -H "Authorization: Bearer $DAGU_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"paused": false}'
```

Pausing requires the admin role, because it affects every workspace. Any authenticated user can read the state, and while the scheduler is paused a banner appears on every page showing who paused it and why.

The flag is stored under `data_dir` at `scheduler/paused.json`, so it survives a restart. A paused scheduler stays paused until someone resumes it. The exception is a pause the scheduler places on itself after the host wakes, which also ends on its own; see [Wake hold](#wake-hold).

### What a pause changes

A pause has the same effect as suspending every DAG by hand:

| Trigger | While paused |
|---------|--------------|
| Schedule | No runs are created |
| Catchup | No runs are replayed |
| Auto-retry | No retries are enqueued |
| [Service](/writing-workflows/services) | No new runs are queued; an active run keeps going |
| [Watched folder](/writing-workflows/watched-folders) | No runs start; arrived files wait and run after the resume |
| Manual, webhook, sub-DAG | Unaffected |

The scheduler process keeps running. Queue processing, zombie detection, and notification delivery continue, which is why pausing is preferable to stopping the process.

### What is discarded

Two kinds of work are dropped rather than deferred. Both match how per-DAG suspension already behaves, but a pause applies them to every DAG at once. A [wake hold](#wake-hold) drops neither.

**Queued scheduled runs are aborted.** A run that the scheduler had already queued is marked `Aborted` with the reason `dag schedule suspended before dispatch` and removed from its queue.

**Catchup windows are erased.** The replay watermark advances while the scheduler is paused, so a pause of any length consumes that much of every DAG's [catchup window](#catchup-missed-run-replay). Nothing replays when you resume. Pause for two hours with `catchup_window: "6h"` and those two hours are gone, not queued.

A pause that outlasts `scheduler.retry_failure_window` (24 hours by default) also ages failed runs out of the retry candidate set, so their [automatic retries](/writing-workflows/durable-execution) never happen.

[One-off schedules](#one-off-schedules) are the exception. A pending one-off stays pending and fires late once the scheduler resumes.

::: tip
If missed runs matter more than a clean freeze, suspend the specific DAGs instead. Suspension and pausing discard catchup identically, but suspending a short list keeps the rest of your schedules replaying normally.
:::

### After resuming

Scheduling picks up from the next tick. Slots that fell inside the paused window are not backfilled. While paused, `NEXT_RUN` reads `-` in `dagu ls` and the next-run column is empty in the web UI.

### Wake hold

After the host wakes from sleep, the scheduler's first tick fires the slot of that minute and every one-off schedule whose time has passed, before anything that manages the DAG definitions can update them. `scheduler.wake_hold` makes the scheduler wait instead:

```yaml
# ~/.config/dagu/config.yaml
scheduler:
  wake_hold: "5m"   # Default: "0", never hold
```

When a tick comes more than a minute late, as it does after a sleep, the scheduler pauses itself. The pause shows `scheduler` as the actor in the API and the banner, and no schedule tick runs while it lasts. The hold ends when the pause is cleared from **System Status** or with the resume request above, or when `wake_hold` has passed, whichever comes first. The held ticks then run in order, starting from the minute the host woke. Slots the host slept through are replayed only within a DAG's [catchup window](#catchup-missed-run-replay), as after any missed tick.

A wake hold is not an operator's pause. Queued runs and automatic retries go on, no queued run is aborted, and no catchup window is erased. If the scheduler is already paused when the host wakes, no hold starts and that pause governs. Pausing the scheduler during a hold replaces the hold with an ordinary pause. A scheduler restart clears a hold left behind.

`DAGU_SCHEDULER_WAKE_HOLD` sets the same value; see the [configuration reference](/server-admin/reference#scheduler).

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
  - run: echo "Running batch process"
```

When no `queue` is specified, DAGs use a local queue with FIFO processing (concurrency of 1).

## Common Patterns

### Business Hours Only
```yaml
schedule: "*/30 8-17 * * MON-FRI"  # Every 30 min, 8AM-5PM weekdays
```

### End of Month
```yaml
schedule: "0 23 28-31 * *"  # 11 PM on last days of month
preconditions:
  - condition: '[ "$(date -d tomorrow +%d 2>/dev/null || date -v+1d +%d)" = 01 ]'
```

The check uses GNU `date -d` and falls back to BSD `date -v`, as on macOS.

### Maintenance Windows
```yaml
schedule:
  start: "0 2 * * SAT"   # Saturday 2 AM
  stop: "0 4 * * SAT"    # Saturday 4 AM
```
