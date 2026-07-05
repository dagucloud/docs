# Execution Control

Advanced control over how your workflows execute.

## Parallel Execution

Execute the same workflow with different parameters in parallel.

### Basic Usage

```yaml
steps:
  - action: dag.run
    with:
      dag: file-processor
      params: "file=${ITEM}"
    parallel:
      items:
        - file1.csv
        - file2.csv
        - file3.csv
---
name: file-processor
params:
  - name: file
    default: ""
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python process.py --file "${params.file}"
```

### With Concurrency Control

```yaml
steps:
  - action: dag.run
    with:
      dag: file-processor
      params: "file=${ITEM}"
    parallel:
      items: ${env.FILE_LIST}
      max_concurrent: 2  # Process max 2 files at a time
```

### Dynamic Items

```yaml
steps:
  - id: list_files
    run: |
      {
        printf 'files<<FILES\n'
        find /data -name "*.csv" -type f
        printf 'FILES\n'
      } >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: files

  - action: dag.run
    with:
      dag: file-processor
      params: "file=${ITEM}"
    parallel: ${steps.list_files.outputs.files}
    depends: list_files
```

## Maximum Active Steps

Control how many steps run concurrently:

```yaml
type: graph
max_active_steps: 2  # Run up to 2 steps in parallel

steps:
  - run: echo "Running task 1"
  - run: echo "Running task 2"
  - run: echo "Running task 3"
  - run: echo "Running task 4"
  # All start in parallel, limited by max_active_steps
```

## Queue Management

Control concurrent workflow instances using global queues:

```yaml
# ~/.config/dagu/config.yaml
queues:
  enabled: true
  config:
    - name: "batch"
      max_concurrency: 2  # Allow 2 concurrent instances
```

```yaml
# In your DAG file
queue: "batch"
schedule: "*/5 * * * *"  # Every 5 minutes
```

When no `queue` is specified, DAGs use a local queue with FIFO processing (concurrency of 1).

Manual queue control:
```bash
# Enqueue with custom ID
dagu enqueue workflow.yaml --run-id=custom-id

# Remove from queue
dagu dequeue default --dag-run=workflow:custom-id
```

## Timeout Control

Set execution time limits:

### Workflow Timeout

```yaml
timeout_sec: 3600  # 1 hour timeout

steps:
  - run: echo "Processing"
```

### Step Timeout (timeout_sec)

Apply a per‑step cap that overrides the workflow timeout for that specific step:

```yaml
timeout_sec: 1800  # Overall DAG timeout (30m)

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: fast_check
    run: curl -sf https://example.com/health
    timeout_sec: 20    # This step fails if still running after 20s

  - id: bulk_import
    run: uv run --python 3.13.9 python import.py   # Inherits 30m DAG timeout

  - id: guarded_external
    run: bash -c 'long_unstable_call'
    timeout_sec: 300   # Give 5m max even though DAG allows 30m
```

Behavior:
- If a step defines `timeout_sec > 0`, a dedicated context deadline is used; it overrides the DAG-level `timeout_sec` only for that step.
- On step timeout the process tree is terminated and the step is marked `failed` with exit code `124` (standard timeout code).
- Dependent steps are skipped unless `continue_on` allows the timed-out step to be treated as non-blocking.
- Omit or set `timeout_sec: 0` on a step to rely solely on the DAG timeout.
- Use step timeouts for external calls (network, APIs, third‑party CLIs) to fail fast while letting other steps proceed.

Validation:
- `timeout_sec` must be `>= 0`; negative values are rejected during spec validation.

Tips:
- Pair with `retry_policy` or `repeat_policy` so transient slowdowns get another attempt instead of burning the entire DAG time budget.
- Log messages and UI will surface both the step-level and DAG-level timeout sources when they trigger.

### Cleanup Timeout

By default DAGs wait 5 seconds for cleanup before forcefully terminating steps. Increase `max_clean_up_time_sec` if your handlers need longer.

```yaml
max_clean_up_time_sec: 300  # allow 5 minutes for cleanup (default timeout: 5s)

handler_on:
  exit:
    run: echo "Cleaning up"  # Must finish within 5 minutes
```

## Initial Delay

Delay workflow start:

```yaml
delay_sec: 60  # Wait 60 seconds before starting

steps:
  - run: echo "Running task"
```

## Execution Order

### Sequential Execution

```yaml
steps:
  - id: step_1
    run: echo "1"
  - id: step_2
    run: echo "2"
    depends: step_1

  - id: step_3
    run: echo "3"
    depends: step_2
```

### Parallel with Dependencies

```yaml
type: graph
steps:
  - id: setup
    run: echo "Setting up"

  - id: task_a
    run: echo "Running task A"
    depends: setup

  - id: task_b
    run: echo "Running task B"
    depends: setup

  - run: echo "Finalizing"
```

## Retry and Repeat Control

For iterating over a list of items, use [`parallel`](/writing-workflows/control-flow#dynamic-iteration) instead.

### Exponential Backoff

Control retry and repeat intervals with exponential backoff to avoid overwhelming systems:

#### Retry with Backoff

```yaml
steps:
  # API call with exponential backoff
  - run: curl https://api.example.com/data
    retry_policy:
      limit: 6
      interval_sec: 1
      backoff: 2.0         # Double interval each time
      max_interval_sec: 60   # Cap at 60 seconds
      exit_code: [429, 503] # Rate limit or service unavailable
      # Intervals: 1s, 2s, 4s, 8s, 16s, 32s → 60s
```

#### Repeat with Backoff

```yaml
steps:
  # Service health check with backoff
  - run: echo "Health check OK"
    env:
      - STATUS: healthy
    repeat_policy:
      repeat: until
      condition: "${env.STATUS}"
      expected: "healthy"
      interval_sec: 2
      backoff: 1.5         # Gentler backoff (1.5x)
      max_interval_sec: 120  # Cap at 2 minutes
      limit: 50
      # Intervals: 2s, 3s, 4.5s, 6.75s, 10.125s...
```

#### Variable References in Repeat Policy

The `interval_sec`, `limit`, and `max_interval_sec` fields accept scoped value references that are resolved at runtime:

```yaml
env:
  - REPEAT_LIMIT: 10
  - POLL_INTERVAL: 5

steps:
  - run: echo "repeating"
    repeat_policy:
      repeat: true
      limit: ${env.REPEAT_LIMIT}
      interval_sec: ${env.POLL_INTERVAL}
```

The values must resolve to valid integers at runtime.
