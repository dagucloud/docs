# Step Defaults

Define default step configuration once at the DAG level. Steps inherit these values and can override them individually.

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
| `preconditions` | array | Preconditions added to each step |

See [YAML Specification - Step Defaults](/reference/yaml#step-defaults) for the field reference.

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

**Override fields** (`retry_policy`, `continue_on`, `repeat_policy`, `timeout_sec`, `mail_on_error`, `signal_on_stop`): The default is applied only when the step does not set its own value. When a step defines the field, the step's value is used entirely — there is no field-level merging within the object.

**Additive fields** (`env`, `preconditions`): Default entries are prepended before the step's own entries. Both sets are present at runtime.

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
  - name: fetch-data
    command: curl https://api.example.com/data

  - name: process-data
    command: ./process.sh
```

### Shared Continue On

All steps continue execution on failure:

```yaml
defaults:
  continue_on: failed

steps:
  - name: cleanup-cache
    command: rm -rf /tmp/cache/*

  - name: cleanup-logs
    command: find /var/log -name "*.old" -delete

  - name: report
    command: echo "cleanup done"
```

### Step Override

A step defines its own `retry_policy`, replacing the default entirely:

```yaml
defaults:
  retry_policy:
    limit: 5
    interval_sec: 10
    exit_code: [1]

steps:
  # Inherits retry_policy from defaults (limit: 5)
  - name: fetch-data
    command: curl https://api.example.com/data

  # Uses its own retry_policy (limit: 1), default is ignored
  - name: send-notification
    command: ./notify.sh
    retry_policy:
      limit: 1
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
  - name: deploy
    command: echo "${LOG_LEVEL} ${REGION} ${SERVICE}"
    env:
      - SERVICE: web-api
    # Effective env: [LOG_LEVEL=info, REGION=us-east-1, SERVICE=web-api]
```

### Additive Preconditions

Default preconditions are prepended before step preconditions. All must pass for the step to execute:

```yaml
defaults:
  preconditions:
    - condition: "${ENVIRONMENT}"
      expected: "production"

steps:
  - name: deploy
    command: ./deploy.sh
    preconditions:
      - condition: "`git branch --show-current`"
        expected: "main"
    # Must satisfy both: ENVIRONMENT=production AND branch=main
```

### Handler Inheritance

`handler_on` steps also inherit from `defaults`:

```yaml
defaults:
  timeout_sec: 300

steps:
  - name: process
    command: ./run.sh
    # timeout_sec: 300 (inherited)

handler_on:
  failure:
    command: ./alert.sh
    # timeout_sec: 300 (inherited)
  exit:
    command: ./cleanup.sh
    # timeout_sec: 300 (inherited)
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
  - name: fetch-users
    command: curl https://api.example.com/users
    output: USERS

  - name: fetch-orders
    command: curl https://api.example.com/orders
    output: ORDERS

  - name: generate-report
    command: ./report.sh
    # Overrides retry_policy — this step must not retry
    retry_policy:
      limit: 0
    env:
      - OUTPUT_DIR: /reports
    # Effective env: [NOTIFY=true, OUTPUT_DIR=/reports]
```

## Interaction with Base Configuration

The `defaults` field is a DAG-level field. When set in [base configuration](/configurations/base-config), it is inherited by all DAGs. A DAG-level `defaults` overrides the base configuration's `defaults` (standard merge behavior — the DAG value wins).

## See Also

- [YAML Specification - Step Defaults](/reference/yaml#step-defaults) — Field reference
- [Error Handling](/writing-workflows/error-handling) — `retry_policy`, `continue_on` usage
- [Base Configuration](/configurations/base-config) — Shared defaults across all DAGs
