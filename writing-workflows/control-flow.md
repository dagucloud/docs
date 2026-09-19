# Control Flow

Control how your DAG executes with conditions, dependencies, and repetition.

## Dependencies

Define execution order with step dependencies.

### Basic Dependencies

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: download
    run: wget https://example.com/data.zip  # Download archive

  - id: extract
    run: unzip data.zip                     # Extract files
    depends: download

  - id: process
    run: uv run --python 3.13.9 python process.py                  # Process data
    depends: extract
```

### Explicit Dependencies

Use `depends` when you need parallel execution or custom dependency relationships:

```yaml
steps:
  - id: download_a
    run: wget https://example.com/a.zip

  - id: download_b
    run: wget https://example.com/b.zip

  - id: merge
    run: echo "Merging a.zip and b.zip"
    depends: [download_a, download_b]
```

## Modular Workflows and Iteration Patterns

### Nested Workflows

Run other workflows as steps and compose them hierarchically. See [Sub-DAGs](/writing-workflows/sub-dags) for the full reference.

```yaml
steps:
  - id: extract
    action: dag.run
    with:
      dag: workflows/extract.yaml
      params: "source=production"

  - id: transform
    action: dag.run
    with:
      dag: workflows/transform.yaml
      params: "source=production"
    depends: extract

  - id: load
    action: dag.run
    with:
      dag: workflows/load.yaml
      params: "target=warehouse"
    depends: transform
```

> **Note**: Sub-DAGs do not inherit `handler_on` from the base configuration. Each nested workflow should define its own lifecycle handlers if needed. See [Sub-DAG Handler Isolation](/writing-workflows/lifecycle-handlers#sub-dag-handler-isolation) for details.

> **Note**: Sub-DAGs also do not inherit parent DAG `tools`. If a child workflow uses a managed external command, declare `tools` in the child workflow. See [Tools: Sub-DAGs](/writing-workflows/tools#sub-dags).

### Synchronous vs Asynchronous Child Workflows

Use `action: dag.run` when the parent must wait for the child DAG to finish before continuing. The child runs as a sub-DAG of the parent, and the parent step reflects the child result.

Use `action: dag.enqueue` when the parent only needs to queue another DAG and continue once the queue item is created. The child becomes its own top-level DAG run with status `queued`, while the parent keeps a reference to it in the sub-DAG run list for traceability.

```yaml
params:
  - name: date
    default: 2026-01-01

steps:
  - id: fanout_report
    action: dag.enqueue
    with:
      dag: workflows/report.yaml
      params:
        date: ${params.date}
      queue: background

  - id: continue_parent
    run: echo "Report workflow was queued"
    depends: fanout_report
```

If `with.queue` is omitted, the child DAG uses its own `queue` setting, base-config default, or local DAG queue. Use `dag.run` instead when later parent steps need the child output or success/failure result before they execute.

**Working Directory:**

A child DAG run does not inherit the parent's working directory. Each child run gets its own work directory, so parallel children cannot collide on relative paths:

```yaml
working_dir: /app/project

steps:
  - action: dag.run
    with:
      dag: child-task    # Child runs in its own work directory
---
name: child-task
steps:
  - run: pwd             # Outputs the child run work directory
```

To pin a child to a specific directory, declare `working_dir` in the child DAG:

```yaml
# child-with-custom-dir.yaml
working_dir: /custom/path
steps:
  - run: pwd                     # Outputs: /custom/path
```

See [Sub-DAGs: Working Directory](/writing-workflows/sub-dags#working-directory).

### Multiple DAGs in One File

Define multiple DAGs separated by `---` and call by name.

```yaml
steps:
  - action: dag.run
    with:
      dag: data-processor
      params: "type=daily"
---
name: data-processor
params:
  - name: type
    default: batch
steps:
  - id: extract
    run: echo "Extracting ${params.type} data"

  - id: transform
    run: echo "Transforming data"
    depends: extract
```

### Dynamic Iteration

Discover work at runtime and iterate over it in parallel.

```yaml
steps:
  - id: discover_tasks
    run: |
      printf 'tasks=file1.csv,file2.csv,file3.csv\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: tasks

  - id: process_tasks
    action: dag.run
    with:
      dag: worker
      params: "file=${ITEM}"
    parallel:
      items: ${steps.discover_tasks.outputs.tasks}
      max_concurrent: 1
    depends: discover_tasks
---
name: worker
params:
  - name: file
    default: ""
steps:
  - id: process_file
    run: echo "Processing ${params.file}"
```

### Map-Reduce Pattern

Split, map in parallel, then reduce results.

```yaml
steps:
  - id: split_chunks
    run: |
      printf 'chunks=chunk1,chunk2,chunk3\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: chunks

  - id: map_chunks
    action: dag.run
    with:
      dag: worker
      params: "chunk=${ITEM}"
    parallel:
      items: ${steps.split_chunks.outputs.chunks}
      max_concurrent: 3
    depends: split_chunks

  - id: reduce_results
    run: echo "Chunk workers finished"
    depends: map_chunks
---
name: worker
params:
  - name: chunk
    default: ""
steps:
  - id: process_chunk
    run: echo "Processing ${params.chunk}"
```

## Conditional Execution

Run steps only when conditions are met.

### Basic Preconditions

```yaml
steps:
  - run: echo "Deploying to production"
    preconditions:
      - condition: "${env.ENVIRONMENT}"
        expected: "production"
```

With `expected`, `condition` compares the resolved string value. Backticks and `$()` stay literal in this form; use `eval` when the compared value must be computed dynamically.

When `expected` is omitted, Dagu treats `condition` as a command check. Dagu first replaces variables in the condition string. If a shell is configured, the result runs through that shell. Without a shell, Dagu executes the resulting string directly, so shell syntax requires an active shell.

  ```yaml
  steps:
    - run: echo "Threshold reached"
      with:
        shell: bash
      preconditions:
        - condition: "test ${env.DEV_PCENT} -ge ${env.DEV_ALERT}"
  ```

For a numeric comparison you no longer need a shell. See
[Numeric Comparison](#numeric-comparison), which compares the values directly and works
the same way on Windows.

### Command Output Conditions

```yaml
steps:
  - run: echo "Deploying application"
    preconditions:
      - eval: "$(git branch --show-current)"
        expected: "main"
```

`eval` accepts both `$()` and backtick command substitution. The `$()` form is usually easier to read and quote, but the backtick form is also valid:

```yaml
steps:
  - run: echo "Deploying application"
    preconditions:
      - eval: "`git branch --show-current`"
        expected: "main"
```

### Regex Matching

```yaml
steps:
  # Run only on weekdays
  - run: echo "Running batch job"
    preconditions:
      - eval: "$(date +%u)"
        expected: "re:[1-5]"  # Monday-Friday
```

**Note**: Use `eval` only with `expected`. For plain exit-code checks, omit `expected` and keep the command in `condition`.

### Numeric Comparison

Use the `num:` prefix to compare numbers instead of text. The operators are `>`, `>=`,
`<`, and `<=`:

```yaml
steps:
  - id: score
    run: echo 0.87
    output: CONFIDENCE

  - id: handle_automatically
    depends: score
    preconditions:
      - condition: "${CONFIDENCE}"
        expected: "num:>=0.8"
    run: echo "Confident enough to handle without review"
```

Both sides are compared as numbers, so `0.9` is greater than `0.45` even though the text
`"0.9"` sorts after `"0.45"`. This replaces shelling out to `test` or `awk`, which also
makes the check portable to Windows runners.

There is no `==` operator. Exact string matching already covers equality, and comparing
floating-point numbers for equality is unreliable.

The threshold can come from a variable, so one workflow can carry a different bar per
environment:

```yaml
params:
  - threshold: "0.8"
steps:
  - id: score
    run: echo 0.87
    output: CONFIDENCE

  - id: handle_automatically
    depends: score
    preconditions:
      - condition: "${CONFIDENCE}"
        expected: "num:>=${threshold}"
    run: echo "Above the configured bar"
```

A threshold reference must be the whole number and nothing else: `num:>=${threshold}` is
valid, `num:>=0.${threshold}` is not. Any reference form that works in `condition` works
here, including `${params.threshold}`, `${env.THRESHOLD}`, and `$THRESHOLD`.

::: warning A value that is not a number fails the step
A comparison that simply does not hold skips the step, exactly like any other unmet
precondition. But a value that is not a number at all, such as empty text or an
unresolved reference, is an evaluation error and **fails** the step instead.

That is deliberate: a numeric gate that silently stopped gating would let work through
unchecked. If a value may legitimately be missing, guard it with a separate precondition
first.
:::

Numeric matching reads the whole value, not one line at a time as literal and regex
matching do. Surrounding whitespace is ignored, so trailing newlines are fine, but a
multi-line value is never a number.

Combine two bounds to gate on a range, since conditions are combined with AND:

```yaml
steps:
  - id: score
    run: echo 0.5
    output: CONFIDENCE

  - id: human_review
    depends: score
    preconditions:
      - condition: "${CONFIDENCE}"
        expected: "num:<0.9"
      - condition: "${CONFIDENCE}"
        expected: "num:>0.1"
    run: echo "Middle band, send to a human"
```

### Multiple Conditions

All conditions must pass:

```yaml
steps:
  - run: echo "Deploying application"
    preconditions:
      - condition: "${env.ENVIRONMENT}"
        expected: "production"
      - condition: "${env.APPROVED}"
        expected: "true"
      - eval: "$(date +%H)"
        expected: "re:0[8-9]|1[0-7]"  # 8 AM - 5 PM
```

### Negated Conditions

Use `negate: true` to invert condition logic. The step runs when the condition does **not** match:

```yaml
steps:
  # Skip deployment in production environment
  - run: echo "Running experimental feature"
    preconditions:
      - condition: "${env.ENVIRONMENT}"
        expected: "production"
        negate: true  # Runs only when NOT in production
```

With command-based conditions, `negate` inverts the exit code check:

```yaml
steps:
  # Run only if service is NOT running
  - run: echo "Starting service"
    preconditions:
      - condition: "pgrep -f my-service"
        negate: true  # Runs when command fails (service not found)
```

Combine `negate` with regex patterns for exclusion logic:

```yaml
steps:
  # Skip on weekends
  - run: echo "Running weekday job"
    preconditions:
      - eval: "$(date +%u)"
        expected: "re:[67]"  # 6=Saturday, 7=Sunday
        negate: true         # Runs when NOT weekend
```

### File/Directory Checks

```yaml
steps:
  - run: echo "Processing"
    preconditions:
      - condition: "test -f /data/input.csv"
      - condition: "test -d /output"
```

### Router Steps

Route execution to different steps based on a runtime value. Router steps evaluate an expression and run all target steps whose pattern matches. Router steps run in graph workflows, which is the default.

#### Basic Routing

```yaml
env:
  - STATUS: production
steps:
  - id: router
    action: router.route
    with:
      value: ${env.STATUS}
      routes:
        "production": [prod_handler]
        "staging": [staging_handler]

  - id: prod_handler
    run: echo "Deploying to production"

  - id: staging_handler
    run: echo "Deploying to staging"
```

#### Regex Patterns

Use the `re:` prefix for pattern matching:

```yaml
env:
  - INPUT: apple_pie
steps:
  - id: router
    action: router.route
    with:
      value: ${env.INPUT}
      routes:
        "re:^apple.*": [apple_handler]
        "re:^banana.*": [banana_handler]

  - id: apple_handler
    run: echo "Apple route"

  - id: banana_handler
    run: echo "Banana route"
```

#### Numeric Routes

A route pattern accepts `num:` as well, so a run can branch on a number. Keep the routes
mutually exclusive and exactly one target runs:

```yaml
type: graph
env:
  - SCORE: "0.95"
steps:
  - id: router
    action: router.route
    with:
      value: ${env.SCORE}
      routes:
        "num:>=0.9": [auto_approve]
        "num:<0.9": [needs_review]

  - id: auto_approve
    run: echo "Approved automatically"

  - id: needs_review
    run: echo "Sent for review"
```

> **Note**: no single route pattern expresses a middle band such as `0.1 < x < 0.9`,
> because a route carries one pattern. Put the bounds on the target step as two
> preconditions instead, as shown in [Numeric Comparison](#numeric-comparison).

::: warning A numeric route fails the run on a non-numeric value
When a workflow declares any `num:` route and the value is not a number, the router step
itself fails and **no** target runs. That includes a target whose pattern matches the text
and a `re:.*` catch-all. A routing decision that cannot be evaluated is not partly carried
out.

So a catch-all cannot be used as a safety net for non-numeric input. Make sure the value
is a number before routing on it.
:::

#### Catch-All Route

Use `re:.*` as a default fallback:

```yaml
env:
  - INPUT: unknown_value
steps:
  - id: router
    action: router.route
    with:
      value: ${env.INPUT}
      routes:
        "specific": [specific_handler]
        "re:.*": [default_handler]

  - id: specific_handler
    run: echo "Specific route"

  - id: default_handler
    run: echo "Default route"
```

#### Multiple Targets Per Route

A single pattern can dispatch to multiple steps:

```yaml
env:
  - INPUT: trigger
steps:
  - id: router
    action: router.route
    with:
      value: ${env.INPUT}
      routes:
        "trigger": [step_a, step_b]

  - id: step_a
    run: echo "Step A"

  - id: step_b
    run: echo "Step B"
```

#### Routing Based on Step Output

Use a previous step's output as the router value:

```yaml
steps:
  - id: check_status
    run: printf 'status=success\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: status

  - id: router
    action: router.route
    with:
      value: ${steps.check_status.outputs.status}
      routes:
        "success": [success_handler]
        "failure": [failure_handler]
    depends: check_status

  - id: success_handler
    run: echo "Handling success"

  - id: failure_handler
    run: echo "Handling failure"
```

#### Chained Routers

Nest routers for multi-level decisions:

```yaml
env:
  - CATEGORY: electronics
  - SUBCATEGORY: phone
steps:
  - id: category_router
    action: router.route
    with:
      value: ${env.CATEGORY}
      routes:
        "electronics": [electronics_router]
        "clothing": [clothing_handler]

  - id: electronics_router
    action: router.route
    with:
      value: ${env.SUBCATEGORY}
      routes:
        "phone": [phone_handler]
        "laptop": [laptop_handler]

  - id: phone_handler
    run: echo "Phone"

  - id: laptop_handler
    run: echo "Laptop"

  - id: clothing_handler
    run: echo "Clothing"
```

> **Evaluation order**: Exact and `num:` matches are checked first, then regex patterns in alphabetical order, with catch-all (`re:.*`) last. All matching routes execute their targets, not just the first match.

> **Constraints**: Router steps run in graph workflows. Each step can only be targeted by one route across all routers.

## Repetition

Repeat steps with explicit 'while' or 'until' modes for clear control flow.

For iterating over a list of items, use [`parallel`](#dynamic-iteration) instead.

### Repeat While Mode

The 'while' mode repeats a step while a condition is true.

```yaml
steps:
  - run: nc -z localhost 8080
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
  - run: check-job-status.sh
    env:
      - STATUS: COMPLETED
    repeat_policy:
      repeat: until
      condition: "${env.STATUS}"
      expected: "COMPLETED"   # Repeat UNTIL status is COMPLETED
      interval_sec: 30
      limit: 120              # Maximum 1 hour
```

`repeat_policy.expected` accepts the same `re:` and `num:` prefixes as a precondition, so
a step can wait for a number to cross a threshold:

```yaml
steps:
  - id: wait_for_backlog_to_drain
    run: queue-depth.sh
    output: DEPTH
    repeat_policy:
      repeat: until
      condition: "${DEPTH}"
      expected: "num:<=10"    # Repeat UNTIL the backlog is 10 or fewer
      interval_sec: 30
      limit: 120
```

> **Note**: always set `limit` on an `until` repeat. Without it the step repeats
> indefinitely while the condition stays unmet.

### Conditional Repeat Patterns

#### While Process is Running
```yaml
steps:
  - run: pgrep -f "my-app"
    repeat_policy:
      repeat: while
      exit_code: [0]      # Exit code 0 means process found
      interval_sec: 60    # Check every minute
```

#### Until File Exists
```yaml
steps:
  - run: test -f /tmp/output.csv
    repeat_policy:
      repeat: until
      exit_code: [0]      # Exit code 0 means file exists
      interval_sec: 5
      limit: 60          # Maximum 5 minutes
```

#### While Condition with Output
```yaml
steps:
  - run: curl -sf http://api/health
    env:
      - HEALTH_STATUS: healthy
    repeat_policy:
      repeat: while
      condition: "${env.HEALTH_STATUS}"
      expected: "healthy"
      interval_sec: 30
```

### Exponential Backoff for Repeats

Gradually increase intervals between repeat attempts:

```yaml
steps:
  # Exponential backoff with while mode
  - run: nc -z localhost 8080
    repeat_policy:
      repeat: while
      exit_code: [1]        # Repeat while connection fails
      interval_sec: 1       # Start with 1 second
      backoff: true        # true = 2.0 multiplier
      limit: 10
      # Intervals: 1s, 2s, 4s, 8s, 16s, 32s...
      
  # Custom backoff multiplier with until mode
  - run: check-job-status.sh
    env:
      - STATUS: COMPLETED
    repeat_policy:
      repeat: until
      condition: "${env.STATUS}"
      expected: "COMPLETED"
      interval_sec: 5
      backoff: 1.5         # Gentler backoff
      limit: 20
      # Intervals: 5s, 7.5s, 11.25s, 16.875s...
      
  # Backoff with max interval cap
  - run: curl -s https://api.example.com/status
    env:
      - API_STATUS: ready
    repeat_policy:
      repeat: until
      condition: "${env.API_STATUS}"
      expected: "ready"
      interval_sec: 2
      backoff: 2.0
      max_interval_sec: 60   # Never wait more than 1 minute
      limit: 100
      # Intervals: 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s...
```

**Backoff Formula**: `interval * (backoff ^ attemptCount)`

### Variable References in Repeat Policy

The `interval_sec`, `limit`, and `max_interval_sec` fields accept scoped value references that are resolved at runtime. This lets you parameterize repeat behavior through environment variables or DAG parameters.

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

Repeat-policy numeric fields do not execute command substitutions. Compute a
dynamic integer through an inline parameter `eval`, then reference it:

```yaml
params:
  - name: repeat_limit
    type: integer
    eval: "`printf 3`"

steps:
  - run: echo "repeating"
    repeat_policy:
      repeat: true
      limit: ${params.repeat_limit}
      interval_sec: 0
```

The values must resolve to valid integers at runtime. If a variable reference cannot be resolved or does not produce an integer, the step fails during preparation.

## Continue On Conditions

### Continue on Failure

```yaml
steps:
  - id: cleanup
    run: echo "Cleaning up"
    continue_on: failed  # Shorthand syntax
  - id: process
    run: echo "Processing"
    depends: cleanup
```

### Continue on Specific Exit Codes

```yaml
steps:
  - id: check_status
    run: echo "Checking status"
    continue_on:
      exit_code: [0, 1, 2]  # Continue on these codes
  - id: process
    run: echo "Processing"
    depends: check_status
```

### Continue on Output Match

```yaml
steps:
  - id: validate
    run: echo "Validating"
    continue_on:
      output:
        - "WARNING"
        - "SKIP"
        - 're:^\[WARN\]'        # Regex: lines starting with [WARN]
        - "re:error.*ignored"   # Regex: error...ignored pattern
  - id: process
    run: echo "Processing"
    depends: validate
```

> **Note**: `continue_on.output` takes literal substrings and `re:` patterns only. The
> `num:` prefix is not supported here and would be matched as literal text, so it would
> never match. Numeric comparison applies to `preconditions` and router routes.

### Continue on Skipped

```yaml
steps:
  - id: enable_feature
    run: echo "Enabling feature"
    preconditions:
      - condition: "${env.FEATURE_FLAG}"
        expected: "enabled"
    continue_on: skipped  # Shorthand syntax
  - id: process
    run: echo "Processing"  # Runs regardless of optional feature
    depends: enable_feature
```

### Mark as Success

```yaml
steps:
  - run: echo "Running optional task"
    continue_on:
      failure: true
      mark_success: true  # Mark step as successful
```

### Complex Conditions

Combine multiple conditions for sophisticated control flow:

```yaml
steps:
  # Tool with complex exit code meanings
  - id: analyze_data
    run: echo "Analyzing data"
    continue_on:
      exit_code: [0, 3, 4, 5]  # Various non-error states
      output:
        - "Analysis complete with warnings"
        - "re:Found [0-9]+ minor issues"
      mark_success: true
      
  # Graceful degradation pattern
  - id: try_advanced_method
    run: echo "Processing with advanced settings"
    continue_on:
      failure: true
      output: ["FALLBACK REQUIRED", "re:.*not available.*"]
      
  - id: simple_method
    run: echo "Processing with simple settings"
    preconditions:
      - condition: "${env.TRY_ADVANCED_METHOD_EXIT_CODE}"
        expected: "re:[1-9][0-9]*"
    depends: try_advanced_method
        
  # Skip pattern with continuation
  - id: optional_feature
    run: echo "Running feature"
    preconditions:
      - condition: "${env.ENABLE_FEATURE}"
        expected: "true"
    continue_on:
      skipped: true  # Continue if precondition not met
```

See the [Continue On Reference](/writing-workflows/continue-on) for complete documentation.

## DAG-Level Conditions

### Preconditions

```yaml
preconditions:
  - eval: "$(date +%u)"
    expected: "re:[1-5]"  # Weekdays only

steps:
  - run: echo "Running daily job"
```

### Negated DAG Preconditions

Use `negate: true` at the DAG level to skip the entire workflow when conditions match:

```yaml
# Skip this DAG in production
preconditions:
  - condition: "${env.ENVIRONMENT}"
    expected: "production"
    negate: true  # DAG runs only when NOT in production

steps:
  - run: echo "Running development task"
```

```yaml
# Run maintenance only outside business hours
preconditions:
  - eval: "$(date +%H)"
    expected: "re:0[9]|1[0-7]"  # 9 AM - 5 PM
    negate: true                # Runs when NOT during business hours

steps:
  - run: echo "Running maintenance"
```

### Skip If Already Successful

```yaml
schedule: "0 * * * *"  # Every hour
skip_if_successful: true  # Skip if already ran successfully today (e.g., run manually)

steps:
  - run: echo "Syncing data"
```
