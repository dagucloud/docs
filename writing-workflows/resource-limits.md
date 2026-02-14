# Resource Limits

Manage workflow execution with concurrency limits.

## Concurrency Control

```yaml
max_active_steps: 1       # Max 1 step running concurrently within the DAG

steps:
  - command: sh -c "echo Starting heavy computation; sleep 3; echo Completed"
  - command: echo "Processing large dataset"
  - parallel:
      items: ${FILE_LIST}
      max_concurrent: 3  # Limit parallel I/O
    command: echo "Processing file ${ITEM}"
```

For controlling concurrent DAG instances, use global queues (see below).

## Timeouts

Apply execution caps at both the DAG and step level:

```yaml
timeout_sec: 600         # (Optional) Overall DAG timeout in seconds

steps:
  - name: quick-check
    command: curl -sf https://example.com/health
    timeout_sec: 30      # Kills this step after 30s (overrides DAG-level 600s)
  - name: long-task
    command: python long_task.py   # Inherits DAG-level 600s since no step timeout
```

Behavior:
- A step with `timeout_sec` > 0 gets its own context deadline; it overrides the DAG-level timeout for that step.
- If the timeout is reached, the step is terminated and marked failed with exit code `124` (standard timeout code).
- DAG-level `timeout_sec` enforces a ceiling on total runtime; steps without their own `timeout_sec` respect this.
- Use step timeouts for unreliable external calls or long‑running operations to fail fast while letting other steps continue.

Validation rules:
- `timeout_sec` must be >= 0. `0` (or omitted) means "no explicit timeout" at that scope.
- Negative values are rejected during spec validation.

Tip: Combine `timeout_sec` with retries (repeat policy) so transient network delays get a fresh attempt instead of blocking the whole workflow.

## Limit by Queue

Control concurrent DAG instances using global queues:

```yaml
# ~/.config/dagu/config.yaml
queues:
  enabled: true
  config:
    - name: heavy-jobs
      maxConcurrency: 2
    - name: light-jobs
      maxConcurrency: 10
```

```yaml
# In your DAG file
queue: heavy-jobs       # Assign to queue for concurrency control

steps:
  - command: sh -c "echo Starting intensive task; sleep 10; echo Done"
  - command: echo "Quick task"
```

When no `queue` is specified, DAGs use a local queue with FIFO processing (concurrency of 1).

See [Queue System](/features/queues) for details.
