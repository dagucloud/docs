# Step Defaults

Define default step configuration once at the DAG level. Steps inherit these values and can override them individually.

`defaults.retry_policy` uses the same retry semantics as a step-level `retry_policy`. For exact field behavior and the difference between step retry and root DAG retry, see [Durable Execution](/writing-workflows/durable-execution).

## Supported Fields

The `defaults` block accepts the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `retry_policy` | object | Retry configuration applied to all steps |
| `continue_on` | string/object | Continue-on condition applied to all steps |
| `repeat_policy` | object | Repeat configuration applied to all steps |
| `timeout_sec` | integer | Step timeout in seconds |
| `mail_on_error` | boolean | Send email on step error |
| `signal_on_stop` | string | Signal sent when a step is stopped |
| `env` | array/object | Environment variables added to each step |
| `preconditions` | string/array | Preconditions added to each step |
| `max_concurrent` | integer | Concurrency limit for `parallel` and `foreach` steps that omit `max_concurrent` |

See [YAML Specification - Step Defaults](/writing-workflows/yaml-specification#defaults) for the field reference.

## Merge Rules

| Field | Merge behavior |
|-------|---------------|
| `retry_policy` | Step value replaces default |
| `continue_on` | Step value replaces default |
| `repeat_policy` | Step value replaces default |
| `timeout_sec` | Step value replaces default |
| `mail_on_error` | Step value replaces default |
| `signal_on_stop` | Step value replaces default |
| `env` | Default entries prepended before step entries |
| `preconditions` | Default entries prepended before step entries |
| `max_concurrent` | Step `parallel.max_concurrent` or `foreach.max_concurrent` replaces default |

**Override fields** (`retry_policy`, `continue_on`, `repeat_policy`, `timeout_sec`, `mail_on_error`, `signal_on_stop`): The default is applied only when the step does not set its own value. When a step defines the field, the step's value is used entirely; there is no field-level merging within the object.

**Additive fields** (`env`, `preconditions`): Default entries are prepended before the step's own entries. Both sets are present at runtime.

**Fan-out limit** (`max_concurrent`): Applies only to steps that already have a `parallel` or `foreach` block, and never adds one. The value must be an integer from `1` to `1000`; fractions and `${...}` references are rejected. Without a default, a step that omits `max_concurrent` runs up to `10` items at a time.

Unknown keys inside `defaults` cause a validation error.

## Examples

### Shared Retry Policy

All steps retry up to 3 times on failure:

```yaml
defaults:
  retry_policy:
    limit: 3
    interval_sec: 5

steps:
  - id: fetch_data
    run: curl https://api.example.com/data

  - id: process_data
    run: ./process.sh
    depends: fetch_data
```

### Shared Continue On

All steps continue execution on failure:

```yaml
defaults:
  continue_on: failed

steps:
  - id: cleanup_cache
    run: rm -rf /tmp/cache/*

  - id: cleanup_logs
    run: find /var/log -name "*.old" -delete

  - id: report
    run: echo "cleanup done"
    depends: [cleanup_cache, cleanup_logs]
```

### Step Override or Disable

A step defines its own `retry_policy`, replacing the default entirely:

```yaml
defaults:
  retry_policy:
    limit: 5
    interval_sec: 10
    exit_code: [1]

steps:
  # Inherits retry_policy from defaults (limit: 5)
  - id: fetch_data
    run: curl https://api.example.com/data

  # Uses its own retry_policy (limit: 1), default is ignored
  - id: send_notification
    run: ./notify.sh
    retry_policy:
      limit: 1
      interval_sec: 0

  # Disables the inherited retry policy for this step
  - id: run_once
    run: ./run-once.sh
    retry_policy:
      limit: 0
      interval_sec: 0
```

### Additive Environment Variables

Default `env` entries are prepended before step `env` entries. Both are available at runtime:

```yaml
defaults:
  env:
    - LOG_LEVEL: info
    - REGION: us-east-1

steps:
  - id: deploy
    run: echo "${env.LOG_LEVEL} ${env.REGION} ${env.SERVICE}"
    env:
      - SERVICE: web-api
    # Effective env: [LOG_LEVEL=info, REGION=us-east-1, SERVICE=web-api]
```

### Additive Preconditions

Default preconditions are prepended before step preconditions. All must pass for the step to execute:

```yaml
defaults:
  preconditions:
    - condition: "${env.ENVIRONMENT}"
      expected: "production"

steps:
  - id: deploy
    run: ./deploy.sh
    preconditions:
      - eval: "$(git branch --show-current)"
        expected: "main"
    # Must satisfy both: ENVIRONMENT=production AND branch=main
```

### Shared Fan-out Limit

`max_concurrent` sets the limit for every `parallel` and `foreach` step that does not set its own:

```yaml
defaults:
  max_concurrent: 3

steps:
  - id: process_files
    action: dag.run
    with:
      dag: file_processor
      params: "file=${ITEM}"
    parallel:
      items: [a.csv, b.csv, c.csv, d.csv, e.csv]
    # Up to 3 child runs at a time (inherited)

  - id: notify_users
    foreach:
      items: [alice, bob, carol, dave]
      max_concurrent: 1
      steps:
        - id: send
          run: ./notify.sh ${foreach.item}
    # One item at a time (step value wins)
```

### Handler Inheritance

`handler_on` steps also inherit from `defaults`:

```yaml
defaults:
  timeout_sec: 300

steps:
  - id: process
    run: ./run.sh
    # timeout_sec: 300 (inherited)

handler_on:
  failure:
    run: ./alert.sh
    # timeout_sec: 300 (inherited)
  exit:
    run: ./cleanup.sh
    # timeout_sec: 300 (inherited)
```

### Foreach Body Inheritance

Steps inside `foreach.steps` inherit from `defaults` under the same merge rules as top-level steps:

```yaml
defaults:
  timeout_sec: 300
  max_concurrent: 4

steps:
  - id: per_region
    foreach:
      items: [us, eu, ap]
      steps:
        - id: deploy
          run: ./deploy.sh ${foreach.item}
          # timeout_sec: 300 (inherited)
        - id: backfill
          depends: deploy
          foreach:
            items: [orders, users]
            steps:
              - id: copy
                run: ./backfill.sh ${foreach.item}
          # Up to 4 tables at a time (inherited)
```

### Combined Example

A realistic workflow using multiple default fields with a step override:

```yaml
defaults:
  retry_policy:
    limit: 3
    interval_sec: 5
    exit_code: [1, 255]
  continue_on: failed
  timeout_sec: 600
  env:
    - NOTIFY: "true"

steps:
  - id: fetch_users
    run: curl https://api.example.com/users
    output: USERS

  - id: fetch_orders
    run: curl https://api.example.com/orders
    output: ORDERS

  - id: generate_report
    run: ./report.sh
    # Overrides retry_policy: this step must not retry
    retry_policy:
      limit: 0
      interval_sec: 0
    env:
      - OUTPUT_DIR: /reports
    # Effective env: [NOTIFY=true, OUTPUT_DIR=/reports]
    depends: [fetch_users, fetch_orders]
```

## Interaction with Base Configuration

The `defaults` field is a DAG-level field. When set in [base configuration](/server-admin/base-config), it is inherited by all DAGs. `defaults` merge field by field, in the order global `base.yaml`, workspace `base.yaml`, then the DAG. A field set at a later level replaces the earlier value, except `env` and `preconditions`, which add to it. A field a level omits keeps the earlier value, so a DAG that sets only `timeout_sec` still inherits `max_concurrent` from `base.yaml`.

## See Also

- [YAML Specification - Step Defaults](/writing-workflows/yaml-specification#defaults): Field reference
- [Error Handling](/writing-workflows/error-handling): `retry_policy`, `continue_on` usage
- [Base Configuration](/server-admin/base-config): Shared defaults across all DAGs
