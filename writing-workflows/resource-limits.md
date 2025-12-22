# Resource Limits

Manage workflow execution with concurrency limits.

## Concurrency Control

```yaml
maxActiveRuns: 1        # Only one instance of this DAG
maxActiveSteps: 1       # Max 1 steps running concurrently

steps:
  - command: sh -c "echo Starting heavy computation; sleep 3; echo Completed"
  - command: echo "Processing large dataset"
  - parallel:
      items: ${FILE_LIST}
      maxConcurrent: 3  # Limit parallel I/O
    command: echo "Processing file ${ITEM}"
```

## Timeouts

Apply execution caps at both the DAG and step level:

```yaml
timeoutSec: 600         # (Optional) Overall DAG timeout in seconds

steps:
  - name: quick-check
    command: curl -sf https://example.com/health
    timeoutSec: 30      # Kills this step after 30s (overrides DAG-level 600s)
  - name: long-task
    command: python long_task.py   # Inherits DAG-level 600s since no step timeout
```

Behavior:
- A step with `timeoutSec` > 0 gets its own context deadline; it overrides the DAG-level timeout for that step.
- If the timeout is reached, the step is terminated and marked failed with exit code `124` (standard timeout code).
- DAG-level `timeoutSec` enforces a ceiling on total runtime; steps without their own `timeoutSec` respect this.
- Use step timeouts for unreliable external calls or long‑running operations to fail fast while letting other steps continue.

Validation rules:
- `timeoutSec` must be >= 0. `0` (or omitted) means "no explicit timeout" at that scope.
- Negative values are rejected during spec validation.

Tip: Combine `timeoutSec` with retries (repeat policy) so transient network delays get a fresh attempt instead of blocking the whole workflow.

## Limit by Queue

```yaml
queue: heavy-jobs       # Assign to specific queue
maxActiveRuns: 2        # Queue allows 2 concurrent

steps:
  - command: sh -c "echo Starting intensive task; sleep 10; echo Done"
  - command: echo "Quick task"
```

You can define queues in the global configuration to set concurrency limits.

```yaml
queues:
  enable: true
  heavy-jobs:
    maxConcurrency: 2
  light-jobs:
    maxConcurrency: 10 
```

See [Queue System](/features/queues) for details.
