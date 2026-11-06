# Queue Configuration

Define named queues in `config.yaml` to control how many DAG runs can execute concurrently within each queue. DAGs are assigned to queues using the `queue` field. See [Queue Assignment](/writing-workflows/queues).

## Defining Queues

```yaml
# ~/.config/dagu/config.yaml
queues:
  enabled: true
  config:
    - name: "critical"
      max_concurrency: 5
    - name: "batch"
      max_concurrency: 1
    - name: "reporting"
      max_concurrency: 3
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | bool | Enable the queue system. Default: `true`. Env: `DAGU_QUEUE_ENABLED`. Required for catchup. See [Catchup](/writing-workflows/scheduling#catchup-missed-run-replay). |
| `config[].name` | string | Queue name. DAGs reference this via `queue: "name"`. |
| `config[].max_concurrency` | int | Maximum concurrent DAG runs in this queue. |

::: info
The field `max_active_runs` is deprecated. Use `max_concurrency` instead. If both are set, `max_active_runs` takes precedence for backward compatibility.
:::

## How Concurrency Is Enforced

The scheduler periodically checks each queue. For each queue it calculates:

```
free_slots = max_concurrency - local_running_count - distributed_running_count - inflight_count - outstanding_dispatch_count
```

- **local_running_count**: runs with at least one non-stale proc heartbeat in the proc store; stale proc files are pruned during these checks so leaked heartbeats do not keep queue capacity artificially full
- **distributed_running_count**: distributed runs with a fresh DAG-run lease
- **inflight_count**: items currently being dispatched
- **outstanding_dispatch_count**: distributed dispatch reservations that have been created but are not yet observed as running. When the dispatcher uses the dispatch admission store, reservation capacity is checked by that store instead of this count.

If `free_slots` is zero or negative, no new items are dequeued. Otherwise, up to `free_slots` items are dequeued and started.

Items within a queue are processed FIFO with two priority levels: high and low. High-priority items are dequeued first. The `dagu enqueue` command and catchup runs both enqueue with low priority.

## Queued Runtime Conditions

When a DAG run remains in `queued`, the scheduler may write one runtime condition to the DAG-run status explaining the latest observed reason it is still waiting. This condition is diagnostic state, not a separate DAG-run lifecycle status.

Runtime conditions are exposed as the `conditions` field on queued DAG-run summaries and details. The Web UI shows them in the run's **Run details** on the [workflow page](/overview/web-ui#start-and-control-runs) and in queue item rows. Conditions are cleared when the persisted DAG-run status changes from `queued` to another status.

A queued run carries one condition per `type`. `Runnable` says whether the run can start, and a second condition names the part that holds it back.

| Field | Meaning |
|-------|---------|
| `type` | `Runnable`, or the blocking part: `ConcurrencyReady`, `WorkerAssignmentReady`, `RunRecordReady`, `WorkerReady`, `StartObserved`, or `QueueReady`. |
| `status` | `False` when the run cannot start yet, or `Unknown` when the scheduler could not check. |
| `reason` | Machine-readable reason, shared by the `Runnable` condition and the blocking condition. |
| `message` | Human-readable explanation. |
| `checkedAt` | RFC 3339 timestamp when the scheduler observed the condition. |

The current reasons are:

| Reason | Blocking condition | When it is written |
|--------|--------------------|--------------------|
| `MaxConcurrencyReached` | `ConcurrencyReady`, `False` | Active runs and in-flight dispatches use every slot of the queue's `max_concurrency`. |
| `AssignmentPending` | `WorkerAssignmentReady`, `Unknown` | Dagu is already assigning the run to a worker. |
| `AssignmentUnavailable` | `WorkerAssignmentReady`, `Unknown` | Dagu cannot tell whether worker assignment can proceed. |
| `WorkerDispatchUnavailable` | `WorkerAssignmentReady`, `Unknown` | Dagu attempted worker assignment, but dispatch is temporarily unavailable. The detailed error is logged on the server. |
| `NoMatchingWorker` | `WorkerReady`, `False` | No healthy worker matches the run's `worker_selector`. |
| `NoAvailableWorker` | `WorkerReady`, `False` | No healthy distributed worker is available. |
| `AttemptIdentityMissing` | `RunRecordReady`, `False` | The queued attempt lacks the identity that worker assignment needs. |
| `DAGSnapshotUnavailable` | `RunRecordReady`, `False` | The run's stored DAG snapshot cannot be read. |
| `LaunchFailed` | `StartObserved`, `False` | A local launch failed before the run reported that it started. |
| `StartupNotObserved` | `StartObserved`, `False` | Dagu started the run but saw no heartbeat, lease, or status change within the startup wait window. |
| `RunLivenessUnavailable` | `StartObserved`, `Unknown` | Dagu could not check run liveness while waiting for startup. This reason writes no `Runnable` condition. |
| `QueueStateUnavailable` | `QueueReady`, `Unknown` | The scheduler could not read the queue state. |

There is no `QueueAccepted` condition. A run's `queued` status and queue entry already mean it was accepted into the queue. There is also no "queue full" condition: `MaxConcurrencyReached` means the queue's active-run concurrency limit currently has no free slot; it does not mean the queue cannot accept more queued items.

A new observation replaces the stored condition of the same type unless the stored one is newer. An unchanged observation refreshes `checkedAt` at most once a minute.

## Scheduled Runs and Queues

A DAG assigned to a queue defined in `config.yaml` — by its own `queue` field or
by one inherited from `base.yaml` — has its scheduled runs enqueued rather than
started as the schedule fires. The queue's
`max_concurrency` therefore bounds every run of the DAGs that share it, and a
run waits in `queued` until a slot is free.

A DAG with no `queue` field uses a local queue, and the scheduler starts its
runs directly.

## Catchup Runs and Queues

Catchup runs (missed run replay) are dispatched through the queue system. When the scheduler detects missed cron intervals for a DAG with `catchup_window` set, it enqueues each interval as a queue item with a deterministic run ID. The queue processor then executes them in order.

This means `queues.enabled: true` is required for catchup to work. If queues are disabled, the scheduler logs a warning per DAG and skips catchup entirely.

See [Catchup](/writing-workflows/scheduling#catchup-missed-run-replay) for the full catchup documentation.

## Queues for DAGs Without a `queue` Field

When a DAG does not set `queue`, it uses a local queue named after the DAG itself. Local queues always have `max_concurrency=1`, so only one instance of that DAG runs at a time.

If a queue name appears in enqueued items but is not defined in `config.yaml`, it is treated as a non-global queue with `max_concurrency=1`.

## CLI: `enqueue`

```bash
dagu enqueue [flags] <DAG file> [-- param1 param2 ...]
```

Queues must be enabled in `config.yaml`, otherwise the command returns an error.

| Flag | Short | Description |
|------|-------|-------------|
| `--run-id` | `-r` | DAG run ID. Auto-generated if omitted. |
| `--name` | `-N` | Override the DAG name. |
| `--queue` | `-u` | Override the DAG's `queue` field. |
| `--labels` | | Comma-separated labels (`key=value` or key-only). |
| `--default-working-dir` | | Default working directory for the DAG. |
| `--trigger-type` | | How the run was initiated: `scheduler`, `manual`, `webhook`, `subdag`, `retry`, `catchup`, `restart`. Default: `manual`. |

```bash
# Enqueue with default settings
dagu enqueue workflow.yaml

# Custom run ID and parameters
dagu enqueue --run-id=batch-2024-01-15 workflow.yaml -- DATE=2024-01-15 TYPE=daily

# Override queue at enqueue time
dagu enqueue --queue=high-priority workflow.yaml
```

## CLI: `dequeue`

```bash
dagu dequeue [flags] <queue-name>
```

Removes an item from the queue and marks it as aborted. If no other attempts exist for that DAG run, the run is removed from the store entirely.

| Flag | Short | Description |
|------|-------|-------------|
| `--dag-run` | `-d` | `<DAG-name>:<run-id>` to dequeue a specific run. If omitted, dequeues the first item. |

```bash
# Dequeue the next item from the "default" queue
dagu dequeue default

# Dequeue a specific run
dagu dequeue default --dag-run=workflow:batch-2024-01-15
```

## Queue Data Storage

Queue data is stored at `{data_dir}/queue/` by default. Override with `paths.queue_dir` in `config.yaml` or the `DAGU_QUEUE_DIR` environment variable.
