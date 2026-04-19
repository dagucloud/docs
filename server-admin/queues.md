# Queue Configuration

Define named queues in `config.yaml` to control how many DAG runs can execute concurrently within each queue. DAGs are assigned to queues using the `queue` field — see [Queue Assignment](/writing-workflows/queues).

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
| `enabled` | bool | Enable the queue system. Default: `true`. Env: `DAGU_QUEUE_ENABLED`. Required for catchup — see [Catchup](/writing-workflows/scheduling#catchup-missed-run-replay). |
| `config[].name` | string | Queue name. DAGs reference this via `queue: "name"`. |
| `config[].max_concurrency` | int | Maximum concurrent DAG runs in this queue. |

::: info
The field `max_active_runs` is deprecated. Use `max_concurrency` instead. If both are set, `max_active_runs` takes precedence for backward compatibility.
:::

## How Concurrency Is Enforced

The scheduler periodically checks each queue. For each queue it calculates:

```
free_slots = max_concurrency - running_count - inflight_count
```

- **running_count** — runs with at least one non-stale proc heartbeat in the proc store; stale proc files are pruned during these checks so leaked heartbeats do not keep queue capacity artificially full
- **inflight_count** — items currently being dispatched

If `free_slots` is zero or negative, no new items are dequeued. Otherwise, up to `free_slots` items are dequeued and started.

Items within a queue are processed FIFO with two priority levels: high and low. High-priority items are dequeued first. The `dagu enqueue` command and catchup runs both enqueue with low priority.

## Catchup Runs and Queues

Catchup runs (missed run replay) are dispatched through the queue system. When the scheduler detects missed cron intervals for a DAG with `catchup_window` set, it enqueues each interval as a queue item with a deterministic run ID. The queue processor then executes them in order.

This means `queues.enabled: true` is required for catchup to work. If queues are disabled, the scheduler logs a warning per DAG and skips catchup entirely.

See [Catchup](/writing-workflows/scheduling#catchup-missed-run-replay) for the full catchup documentation.

## Queues for DAGs Without a `queue` Field

When a DAG does not set `queue`, it uses a local queue named after the DAG itself. Local queues always have `max_concurrency=1` — only one instance of that DAG runs at a time.

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
| `--trigger-type` | | How the run was initiated: `scheduler`, `manual`, `webhook`, `subdag`, `retry`, `catchup`. Default: `manual`. |

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
