# Reliability Examples

Examples for retries, backoff, lifecycle handlers, and tolerant failure handling.

<div class="examples-grid">

<div class="example-card">

### Continue on Failure

```yaml
steps:
  # Optional task that may fail
  - id: optional_task
    run: exit 1  # This will fail
    continue_on:
      failure: true
  # This step always runs
  - id: required_task
    run: echo "This must succeed"
    depends: optional_task
```

```mermaid
flowchart LR
    O["optional_task · continue_on: failure"] --> R["required_task"]
    style O stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/error-handling#continue" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Continue on Skipped

```yaml
steps:
  # Optional step that may be skipped
  - id: optional_feature
    run: echo "Enabling feature"
    preconditions:
      - condition: "${env.FEATURE_FLAG}"
        expected: "enabled"
    continue_on:
      skipped: true
  # This step always runs
  - id: main_task
    run: echo "Processing main task"
    depends: optional_feature
```

```mermaid
flowchart LR
    O["optional_feature · continue_on: skipped"] --> M["main_task"]
    style O stroke:lightblue,stroke-width:1.6px,color:#333
    style M stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#continue-on-skipped" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Retry on Failure

```yaml
steps:
  - run: curl https://api.example.com
    retry_policy:
      limit: 3
      interval_sec: 30
```

```mermaid
flowchart TD
    A["curl api.example.com"] --> B{failed?}
    B --> |yes| R["retry 3x · 30s"] --> A
    B --> |no| N[Next step]
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:orange,stroke-width:1.6px,color:#333
    style N stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/error-handling#retry" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Smart Retry Policies

```yaml
steps:
  - run: curl -fsS https://api.example.com/data
    retry_policy:
      limit: 5
      interval_sec: 30
      exit_code: [7, 22, 28]  # curl: connection failed, HTTP status >= 400, timeout
```

```mermaid
flowchart TD
    A["curl -fsS api.example.com/data"] --> B{"curl exit in 7/22/28?"}
    B --> |yes| R["retry 5x · 30s"] --> A
    B --> |no| N[Next step]
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:orange,stroke-width:1.6px,color:#333
    style N stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/error-handling#retry" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Retry with Exponential Backoff

```yaml
steps:
  - run: curl https://api.example.com/data
    retry_policy:
      limit: 5
      interval_sec: 2
      backoff: true        # 2x multiplier
      max_interval_sec: 60   # Cap at 60s
      # Intervals: 2s, 4s, 8s, 16s, 32s → 60s
```

```mermaid
flowchart TD
    A["curl api.example.com/data"] --> B{failed?}
    B --> |yes| R["backoff · 2s → 60s"] --> A
    B --> |no| N[Next step]
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:orange,stroke-width:1.6px,color:#333
    style N stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/error-handling#exponential-backoff" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Repeat with Backoff

> Looking for iteration over a list? See [Parallel Execution](/writing-workflows/execution-control#parallel-execution).

```yaml
steps:
  - run: nc -z localhost 8080
    repeat_policy:
      repeat: while
      exit_code: [1]        # While connection fails
      interval_sec: 1
      backoff: 2.0
      max_interval_sec: 30
      limit: 20
      # Check intervals: 1s, 2s, 4s, 8s, 16s, 30s...
```

```mermaid
flowchart TD
    A["nc -z localhost 8080"] --> B{"exit code == 1?"}
    B --> |yes| W["wait · 1s → 30s backoff"] --> A
    B --> |no| N[Next step]
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lightblue,stroke-width:1.6px,color:#333
    style W stroke:orange,stroke-width:1.6px,color:#333
    style N stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#exponential-backoff-for-repeats" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Lifecycle Handlers

```yaml
steps:
  - run: echo "Processing main task"
handler_on:
  success:
    run: echo "SUCCESS - Workflow completed"
  failure:
    run: echo "FAILURE - Cleaning up failed workflow"
  exit:
    run: echo "EXIT - Always cleanup"
```

```mermaid
stateDiagram-v2
    [*] --> Running
    Running --> Success: Success
    Running --> Failed: Failure
    Success --> NotifySuccess: handler_on.success
    Failed --> CleanupFail: handler_on.failure
    NotifySuccess --> AlwaysCleanup: handler_on.exit
    CleanupFail --> AlwaysCleanup: handler_on.exit
    AlwaysCleanup --> [*]
    
    classDef running stroke:lime,stroke-width:1.6px,color:#333
    classDef success stroke:green,stroke-width:1.6px,color:#333
    classDef failed stroke:red,stroke-width:1.6px,color:#333
    classDef handler stroke:lightblue,stroke-width:1.6px,color:#333
    
    class Running running
    class Success success
    class Failed failed
    class NotifySuccess,CleanupFail,AlwaysCleanup handler
```

<a href="/writing-workflows/lifecycle-handlers" class="learn-more">Learn more →</a>

</div>

</div>
