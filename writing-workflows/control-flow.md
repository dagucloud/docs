# Control Flow

Control how your DAGs executes with conditions, dependencies, and repetition.

## Dependencies

Define execution order with step dependencies.

### Basic Dependencies

```yaml
steps:
  - command: wget https://example.com/data.zip  # Download archive
  - command: unzip data.zip                     # Extract files
  - command: python process.py                  # Process data
```

> **Note**: The above example uses the default `type: chain`, where steps run sequentially in order. To use explicit `depends` declarations for parallel or custom execution order, set `type: graph` at the DAG level.

### Explicit Dependencies (Graph Mode)

Use `type: graph` when you need parallel execution or custom dependency relationships:

```yaml
type: graph
steps:
  - id: download_a
    command: wget https://example.com/a.zip

  - id: download_b
    command: wget https://example.com/b.zip

  - command: echo "Merging a.zip and b.zip"
    depends:
      - command: download_a
      - command: download_b
```

## Modular Workflows and Iteration Patterns

### Nested Workflows

Run other workflows as steps and compose them hierarchically.

```yaml
steps:
  - call: workflows/extract.yaml
    params: "SOURCE=production"

  - call: workflows/transform.yaml
    params: "INPUT=${extract.output}"
  - call: workflows/load.yaml
    params: "DATA=${transform.output}"
```

> **Note**: Sub-DAGs do not inherit `handler_on` from the base configuration. Each nested workflow should define its own lifecycle handlers if needed. See [Sub-DAG Handler Isolation](/writing-workflows/lifecycle-handlers#sub-dag-handler-isolation) for details.

**Working Directory Inheritance:**

When calling sub-DAGs locally, the child inherits the parent's `working_dir` if it doesn't define its own:

```yaml
working_dir: /app/project

steps:
  - call: child-task    # Child runs in /app/project

---
name: child-task
# No working_dir defined - inherits /app/project from parent
steps:
  - command: pwd                 # Outputs: /app/project
```

To override the inherited working directory, define an explicit `working_dir` in the child DAG:

```yaml
name: child-with-custom-dir
working_dir: /custom/path    # Overrides inherited working_dir
steps:
  - command: pwd                     # Outputs: /custom/path
```

> **Note**: Working directory inheritance only applies to local execution. For distributed execution (using `worker_selector`), sub-DAGs use their own context on the worker node.

### Multiple DAGs in One File

Define multiple DAGs separated by `---` and call by name.

```yaml
steps:
  - call: data-processor
    params: "TYPE=daily"

---

name: data-processor
params:
  - TYPE: "batch"
steps:
  - command: echo "Extracting ${TYPE} data"
  - command: echo "Transforming data"
```

### Dynamic Iteration

Discover work at runtime and iterate over it in parallel.

```yaml
steps:
  - command: |
      echo '["file1.csv","file2.csv","file3.csv"]'
    output: TASK_LIST
  - call: worker
    parallel:
      items: ${TASK_LIST}
      max_concurrent: 1
    params: "FILE=${ITEM}"

---
name: worker
params:
  - FILE: ""
steps:
  - command: echo "Processing ${FILE}"

```

### Map-Reduce Pattern

Split, map in parallel, then reduce results.

```yaml
steps:
  - command: |
      echo '["chunk1","chunk2","chunk3"]'
    output: CHUNKS
  - call: worker
    parallel:
      items: ${CHUNKS}
      max_concurrent: 3
    params: "CHUNK=${ITEM}"
    output: MAP_RESULTS

  - command: |
      echo "Reducing results from ${MAP_RESULTS.outputs}"
---
name: worker
params:
  - CHUNK: ""
steps:
  - command: echo "Processing ${CHUNK}"
    output: RESULT
```

## Conditional Execution

Run steps only when conditions are met.

### Basic Preconditions

```yaml
steps:
  - command: echo "Deploying to production"
    preconditions:
      - condition: "${ENVIRONMENT}"
        expected: "production"
```

### Command Output Conditions

```yaml
steps:
  - command: echo "Deploying application"
    preconditions:
      - condition: "`git branch --show-current`"
        expected: "main"
```

### Regex Matching

```yaml
steps:
  # Run only on weekdays
  - command: echo "Running batch job"
    preconditions:
      - condition: "`date +%u`"
        expected: "re:[1-5]"  # Monday-Friday
```

**Note**: When using regex patterns with command outputs, be aware that:
- Lines over 64KB are automatically handled with larger buffers  
- If the total output exceeds `max_output_size` (default 1MB), the step will fail with an error and the output variable won't be set
- For `continue_on.output` patterns in log files, lines up to `max_output_size` can be matched

### Multiple Conditions

All conditions must pass:

```yaml
steps:
  - command: echo "Deploying application"
    preconditions:
      - condition: "${ENVIRONMENT}"
        expected: "production"
      - condition: "${APPROVED}"
        expected: "true"
      - condition: "`date +%H`"
        expected: "re:0[8-9]|1[0-7]"  # 8 AM - 5 PM
```

### Negated Conditions

Use `negate: true` to invert condition logic. The step runs when the condition does **not** match:

```yaml
steps:
  # Skip deployment in production environment
  - command: echo "Running experimental feature"
    preconditions:
      - condition: "${ENVIRONMENT}"
        expected: "production"
        negate: true  # Runs only when NOT in production
```

With command-based conditions, `negate` inverts the exit code check:

```yaml
steps:
  # Run only if service is NOT running
  - command: echo "Starting service"
    preconditions:
      - condition: "pgrep -f my-service"
        negate: true  # Runs when command fails (service not found)
```

Combine `negate` with regex patterns for exclusion logic:

```yaml
steps:
  # Skip on weekends
  - command: echo "Running weekday job"
    preconditions:
      - condition: "`date +%u`"
        expected: "re:[67]"  # 6=Saturday, 7=Sunday
        negate: true         # Runs when NOT weekend
```

### File/Directory Checks

```yaml
steps:
  - command: echo "Processing"
    preconditions:
      - condition: "test -f /data/input.csv"
      - condition: "test -d /output"
```

### Router Steps

Route execution to different steps based on a runtime value. Router steps evaluate an expression and run all target steps whose pattern matches. Requires `type: graph`.

#### Basic Routing

```yaml
type: graph
env:
  - STATUS: production
steps:
  - id: router
    type: router
    value: ${STATUS}
    routes:
      "production": [prod_handler]
      "staging": [staging_handler]

  - id: prod_handler
    command: echo "Deploying to production"

  - id: staging_handler
    command: echo "Deploying to staging"
```

#### Regex Patterns

Use the `re:` prefix for pattern matching:

```yaml
type: graph
env:
  - INPUT: apple_pie
steps:
  - id: router
    type: router
    value: ${INPUT}
    routes:
      "re:^apple.*": [apple_handler]
      "re:^banana.*": [banana_handler]

  - id: apple_handler
    command: echo "Apple route"

  - id: banana_handler
    command: echo "Banana route"
```

#### Catch-All Route

Use `re:.*` as a default fallback:

```yaml
type: graph
env:
  - INPUT: unknown_value
steps:
  - id: router
    type: router
    value: ${INPUT}
    routes:
      "specific": [specific_handler]
      "re:.*": [default_handler]

  - id: specific_handler
    command: echo "Specific route"

  - id: default_handler
    command: echo "Default route"
```

#### Multiple Targets Per Route

A single pattern can dispatch to multiple steps:

```yaml
type: graph
env:
  - INPUT: trigger
steps:
  - id: router
    type: router
    value: ${INPUT}
    routes:
      "trigger": [step_a, step_b]

  - id: step_a
    command: echo "Step A"

  - id: step_b
    command: echo "Step B"
```

#### Routing Based on Step Output

Use a previous step's output as the router value:

```yaml
type: graph
steps:
  - id: check_status
    command: echo "success"
    output: STATUS

  - id: router
    type: router
    value: ${STATUS}
    routes:
      "success": [success_handler]
      "failure": [failure_handler]
    depends: [check_status]

  - id: success_handler
    command: echo "Handling success"

  - id: failure_handler
    command: echo "Handling failure"
```

#### Chained Routers

Nest routers for multi-level decisions:

```yaml
type: graph
env:
  - CATEGORY: electronics
  - SUBCATEGORY: phone
steps:
  - id: category_router
    type: router
    value: ${CATEGORY}
    routes:
      "electronics": [electronics_router]
      "clothing": [clothing_handler]

  - id: electronics_router
    type: router
    value: ${SUBCATEGORY}
    routes:
      "phone": [phone_handler]
      "laptop": [laptop_handler]

  - id: phone_handler
    command: echo "Phone"

  - id: laptop_handler
    command: echo "Laptop"

  - id: clothing_handler
    command: echo "Clothing"
```

> **Evaluation order**: Exact matches are checked first, then regex patterns in alphabetical order, with catch-all (`re:.*`) last. All matching routes execute their targets, not just the first match.

> **Constraints**: Router steps require `type: graph`. Each step can only be targeted by one route across all routers.

## Repetition

Repeat steps with explicit 'while' or 'until' modes for clear control flow.

For iterating over a list of items, use [`parallel`](#dynamic-iteration) instead.

### Repeat While Mode

The 'while' mode repeats a step while a condition is true.

```yaml
steps:
  - command: nc -z localhost 8080
    repeat_policy:
      repeat: while
      exit_code: [1]      # Repeat WHILE connection fails (exit code 1)
      interval_sec: 10    # Wait 10 seconds between attempts
      limit: 30          # Maximum 30 attempts
```

### Repeat Until Mode

The 'until' mode repeats a step until a condition becomes true.

```yaml
steps:
  - command: check-job-status.sh
    output: STATUS
    repeat_policy:
      repeat: until
      condition: "${STATUS}"
      expected: "COMPLETED"   # Repeat UNTIL status is COMPLETED
      interval_sec: 30
      limit: 120              # Maximum 1 hour
```

### Conditional Repeat Patterns

#### While Process is Running
```yaml
steps:
  - command: pgrep -f "my-app"
    repeat_policy:
      repeat: while
      exit_code: [0]      # Exit code 0 means process found
      interval_sec: 60    # Check every minute
```

#### Until File Exists
```yaml
steps:
  - command: test -f /tmp/output.csv
    repeat_policy:
      repeat: until
      exit_code: [0]      # Exit code 0 means file exists
      interval_sec: 5
      limit: 60          # Maximum 5 minutes
```

#### While Condition with Output
```yaml
steps:
  - command: curl -s http://api/health
    output: HEALTH_STATUS
    repeat_policy:
      repeat: while
      condition: "${HEALTH_STATUS}"
      expected: "healthy"
      interval_sec: 30
```

### Exponential Backoff for Repeats

Gradually increase intervals between repeat attempts:

```yaml
steps:
  # Exponential backoff with while mode
  - command: nc -z localhost 8080
    repeat_policy:
      repeat: while
      exit_code: [1]        # Repeat while connection fails
      interval_sec: 1       # Start with 1 second
      backoff: true        # true = 2.0 multiplier
      limit: 10
      # Intervals: 1s, 2s, 4s, 8s, 16s, 32s...
      
  # Custom backoff multiplier with until mode
  - command: check-job-status.sh
    output: STATUS
    repeat_policy:
      repeat: until
      condition: "${STATUS}"
      expected: "COMPLETED"
      interval_sec: 5
      backoff: 1.5         # Gentler backoff
      limit: 20
      # Intervals: 5s, 7.5s, 11.25s, 16.875s...
      
  # Backoff with max interval cap
  - command: curl -s https://api.example.com/status
    output: API_STATUS
    repeat_policy:
      repeat: until
      condition: "${API_STATUS}"
      expected: "ready"
      interval_sec: 2
      backoff: 2.0
      max_interval_sec: 60   # Never wait more than 1 minute
      limit: 100
      # Intervals: 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s...
```

**Backoff Formula**: `interval * (backoff ^ attemptCount)`

## Continue On Conditions

### Continue on Failure

```yaml
steps:
  - command: echo "Cleaning up"
    continue_on: failed  # Shorthand syntax
  - command: echo "Processing"
```

### Continue on Specific Exit Codes

```yaml
steps:
  - command: echo "Checking status"
    continue_on:
      exit_code: [0, 1, 2]  # Continue on these codes
  - command: echo "Processing"
```

### Continue on Output Match

```yaml
steps:
  - command: echo "Validating"
    continue_on:
      output:
        - "WARNING"
        - "SKIP"
        - "re:^\[WARN\]"        # Regex: lines starting with [WARN]
        - "re:error.*ignored"   # Regex: error...ignored pattern
  - command: echo "Processing"
```

### Continue on Skipped

```yaml
steps:
  - command: echo "Enabling feature"
    preconditions:
      - condition: "${FEATURE_FLAG}"
        expected: "enabled"
    continue_on: skipped  # Shorthand syntax
  - command: echo "Processing"  # Runs regardless of optional feature
```

### Mark as Success

```yaml
steps:
  - command: echo "Running optional task"
    continue_on:
      failure: true
      mark_success: true  # Mark step as successful
```

### Complex Conditions

Combine multiple conditions for sophisticated control flow:

```yaml
steps:
  # Tool with complex exit code meanings
  - command: echo "Analyzing data"
    continue_on:
      exit_code: [0, 3, 4, 5]  # Various non-error states
      output:
        - command: "Analysis complete with warnings"
        - command: "re:Found [0-9]+ minor issues"
      mark_success: true
      
  # Graceful degradation pattern
  - command: echo "Processing with advanced settings"
    continue_on:
      failure: true
      output: ["FALLBACK REQUIRED", "re:.*not available.*"]
      
  - command: echo "Processing with simple settings"
    preconditions:
      - condition: "${TRY_ADVANCED_METHOD_EXIT_CODE}"
        expected: "re:[1-9][0-9]*"
        
  # Skip pattern with continuation
  - command: echo "Running feature"
    preconditions:
      - condition: "${ENABLE_FEATURE}"
        expected: "true"
    continue_on:
      skipped: true  # Continue if precondition not met
```

See the [Continue On Reference](/writing-workflows/continue-on) for complete documentation.

## DAG-Level Conditions

### Preconditions

```yaml
preconditions:
  - condition: "`date +%u`"
    expected: "re:[1-5]"  # Weekdays only

steps:
  - command: echo "Running daily job"
```

### Negated DAG Preconditions

Use `negate: true` at the DAG level to skip the entire workflow when conditions match:

```yaml
# Skip this DAG in production
preconditions:
  - condition: "${ENVIRONMENT}"
    expected: "production"
    negate: true  # DAG runs only when NOT in production

steps:
  - command: echo "Running development task"
```

```yaml
# Run maintenance only outside business hours
preconditions:
  - condition: "`date +%H`"
    expected: "re:0[9]|1[0-7]"  # 9 AM - 5 PM
    negate: true                # Runs when NOT during business hours

steps:
  - command: echo "Running maintenance"
```

### Skip If Already Successful

```yaml
schedule: "0 * * * *"  # Every hour
skip_if_successful: true  # Skip if already ran successfully today (e.g., run manually)

steps:
  - command: echo "Syncing data"
```
