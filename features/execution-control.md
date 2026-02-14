# Execution Control

Advanced control over how your workflows execute.

## Parallel Execution

Execute the same workflow with different parameters in parallel.

### Basic Usage

```yaml
steps:
  - call: file-processor
    parallel:
      items:
        - command: "file1.csv"
        - command: "file2.csv"
        - command: "file3.csv"
    params: "FILE=${ITEM}"

---
name: file-processor
params:
  - FILE: ""
steps:
  - command: python process.py --file ${FILE}
```

### With Concurrency Control

```yaml
steps:
  - call: file-processor
    parallel:
      items: ${FILE_LIST}
      max_concurrent: 2  # Process max 2 files at a time
    params: "FILE=${ITEM}"
```

### Dynamic Items

```yaml
steps:
  - command: find /data -name "*.csv" -type f
    output: CSV_FILES
  
  - call: file-processor
    parallel: ${CSV_FILES}
    params: "FILE=${ITEM}"
```

### Capturing Output

```yaml
steps:
  - call: task-processor
    parallel:
      items: [1, 2, 3]
    output: RESULTS
  
  - command: |
      echo "Total: ${RESULTS.summary.total}"
      echo "Succeeded: ${RESULTS.summary.succeeded}"
      echo "Failed: ${RESULTS.summary.failed}"
```

Output structure:
```json
{
  "summary": {
    "total": 3,
    "succeeded": 3,
    "failed": 0
  },
  "outputs": [
    {"RESULT": "output1"},
    {"RESULT": "output2"},
    {"RESULT": "output3"}
  ]
}
```

## Maximum Active Steps

Control how many steps run concurrently:

```yaml
type: graph
max_active_steps: 2  # Run up to 2 steps in parallel

steps:
  - command: echo "Running task 1"
    depends: [] # Explicitly declare no dependency
  - command: echo "Running task 2"
    depends: []
  - command: echo "Running task 3"
    depends: []
  - command: echo "Running task 4"
    depends: []
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
      maxConcurrency: 2  # Allow 2 concurrent instances
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
  - command: echo "Processing"
```

### Step Timeout (timeout_sec)

Apply a per‑step cap that overrides the workflow timeout for that specific step:

```yaml
timeout_sec: 1800  # Overall DAG timeout (30m)

steps:
  - name: fast-check
    command: curl -sf https://example.com/health
    timeout_sec: 20    # This step fails if still running after 20s

  - name: bulk-import
    command: python import.py   # Inherits 30m DAG timeout

  - name: guarded-external
    command: bash -c 'long_unstable_call'
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
    command: echo "Cleaning up"  # Must finish within 5 minutes
```

## Initial Delay

Delay workflow start:

```yaml
delay_sec: 60  # Wait 60 seconds before starting

steps:
  - command: echo "Running task"
```

## Execution Order

### Sequential Execution

```yaml
steps:
  - command: echo "1"
  - command: echo "2"  # Runs after step 1
  - command: echo "3"  # Runs after step 2
```

### Parallel with Dependencies

```yaml
type: graph
steps:
  - name: setup
    command: echo "Setting up"

  - name: task-a
    command: echo "Running task A"
    depends: setup

  - name: task-b
    command: echo "Running task B"
    depends: setup

  - command: echo "Finalizing"
    depends:
      - command: task-a
      - command: task-b
```

## Retry and Repeat Control

For iterating over a list of items, use [`parallel`](/writing-workflows/control-flow#dynamic-iteration) instead.

### Exponential Backoff

Control retry and repeat intervals with exponential backoff to avoid overwhelming systems:

#### Retry with Backoff

```yaml
steps:
  # API call with exponential backoff
  - command: curl https://api.example.com/data
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
  - command: echo "Health check OK"
    output: STATUS
    repeat_policy:
      repeat: until
      condition: "${STATUS}"
      expected: "healthy"
      interval_sec: 2
      backoff: 1.5         # Gentler backoff (1.5x)
      max_interval_sec: 120  # Cap at 2 minutes
      limit: 50
      # Intervals: 2s, 3s, 4.5s, 6.75s, 10.125s...
```
