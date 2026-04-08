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
| `agent` | object | Agent configuration merged per field into a step's `agent` block |

See [YAML Specification - Step Defaults](/writing-workflows/yaml-specification#step-defaults) for the field reference.

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
| `agent` | Step `agent.<field>` value replaces the matching default subfield |

**Override fields** (`retry_policy`, `continue_on`, `repeat_policy`, `timeout_sec`, `mail_on_error`, `signal_on_stop`): The default is applied only when the step does not set its own value. When a step defines the field, the step's value is used entirely — there is no field-level merging within the object.

**Agent fields** (`agent`): Defaults are applied per subfield rather than as a whole-object replacement. Supported default subfields are `model`, `tools`, `skills`, `soul`, `memory`, `prompt`, `max_iterations`, and `safe_mode`.

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
  - id: fetch_data
    command: curl https://api.example.com/data

  - id: process_data
    command: ./process.sh
```

### Shared Continue On

All steps continue execution on failure:

```yaml
defaults:
  continue_on: failed

steps:
  - id: cleanup_cache
    command: rm -rf /tmp/cache/*

  - id: cleanup_logs
    command: find /var/log -name "*.old" -delete

  - id: report
    command: echo "cleanup done"
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
    command: curl https://api.example.com/data

  # Uses its own retry_policy (limit: 1), default is ignored
  - id: send_notification
    command: ./notify.sh
    retry_policy:
      limit: 1
      interval_sec: 0

  # Disables the inherited retry policy for this step
  - id: run_once
    command: ./run-once.sh
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
  - id: deploy
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
  - id: process
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

### Agent Defaults

Use `defaults.agent` to share agent-step configuration across steps:

```yaml
defaults:
  agent:
    model: claude-sonnet
    soul: reviewer
    max_iterations: 30

steps:
  - type: agent
    messages:
      - role: user
        content: "Review the failing workflow"
    # Inherits model, soul, and max_iterations

  - type: agent
    agent:
      model: claude-opus
    messages:
      - role: user
        content: "Summarize the review"
    # Overrides only model; still inherits soul and max_iterations
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
    command: curl https://api.example.com/users
    output: USERS

  - id: fetch_orders
    command: curl https://api.example.com/orders
    output: ORDERS

  - id: generate_report
    command: ./report.sh
    # Overrides retry_policy — this step must not retry
    retry_policy:
      limit: 0
    env:
      - OUTPUT_DIR: /reports
    # Effective env: [NOTIFY=true, OUTPUT_DIR=/reports]
```

## Interaction with Base Configuration

The `defaults` field is a DAG-level field. When set in [base configuration](/server-admin/base-config), it is inherited by all DAGs. A DAG-level `defaults` overrides the base configuration's `defaults` (standard merge behavior — the DAG value wins).

## See Also

- [YAML Specification - Step Defaults](/writing-workflows/yaml-specification#step-defaults) — Field reference
- [Error Handling](/writing-workflows/error-handling) — `retry_policy`, `continue_on` usage
- [Agent Step](/features/agent/step) — `agent` fields and DAG-level agent defaults
- [Base Configuration](/server-admin/base-config) — Shared defaults across all DAGs
