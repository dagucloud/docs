# Base Configuration

Define shared defaults for all DAGs using a `base.yaml` file. This eliminates duplication and ensures consistent behavior across your workflows.

## Overview

The base configuration file provides default values that are automatically inherited by every DAG in your Dagu installation. Use it for:

- **Shared environment variables** - Common settings like timezone, API keys
- **Global handlers** - Failure notifications, cleanup routines
- **Default timeouts** - Consistent execution limits
- **Email/alerting setup** - Team-wide notification configuration
- **External service defaults** - SSH, S3, database connections
- **Shared `eval_params` policy** - Opt workflows into evaluated YAML param defaults by default

Individual DAG files can override any setting from the base configuration.

If `base.yaml` does not exist and base-config auto-creation is enabled, Dagu writes a default `base.yaml` on first startup. The generated file currently enables root DAG retry with:

```yaml
retry_policy:
  limit: 3
  interval_sec: 5
```

## File Location

Dagu looks for the base configuration file based on your directory structure:

| Mode | Base Config Path |
|------|------------------|
| **XDG** (default) | `~/.config/dagu/base.yaml` |
| **Unified** (`DAGU_HOME` set) | `{DAGU_HOME}/base.yaml` |
| **Legacy** (`~/.dagu` exists) | `~/.dagu/base.yaml` |

### Custom Location

Override the default path in your server configuration:

```yaml
# ~/.config/dagu/config.yaml
paths:
  base_config: "/path/to/custom/base.yaml"
```

Or via environment variable:

```bash
export DAGU_BASE_CONFIG=/path/to/custom/base.yaml
```

## How Inheritance Works

When Dagu loads a DAG, it follows this process:

```
1. Load base.yaml (if exists)
2. Load the DAG file
3. Merge: DAG values override base values
4. Apply runtime parameters (highest priority)
```

### Merging Behavior

**Standard fields** - DAG values override base values:

```yaml
# base.yaml
timeout_sec: 3600

# my-dag.yaml
timeout_sec: 7200  # Result: 7200
```

**Array fields** (`env`) - Values are appended, not replaced:

```yaml
# base.yaml
env:
  - TZ=UTC
  - LOG_LEVEL=info

# my-dag.yaml
env:
  - API_KEY=secret

# Result: [TZ=UTC, LOG_LEVEL=info, API_KEY=secret]
```

**Full override fields** (`mail_on`) - Entire structure is replaced:

```yaml
# base.yaml
mail_on:
  failure: true
  success: true

# my-dag.yaml
mail_on:
  failure: false
# Result: failure=false, success=false (not inherited)
```

**Boolean fields such as `eval_params`** - the DAG overrides only when it sets the field explicitly:

```yaml
# base.yaml
eval_params: true

# child.yaml
# eval_params omitted
# Result: true (inherited)
```

```yaml
# base.yaml
eval_params: true

# child.yaml
eval_params: false
# Result: false (explicit DAG override)
```

### Precedence Order

From lowest to highest priority:

1. OS environment variables
2. `base.yaml` configuration
3. Individual DAG file
4. Runtime parameters (CLI or API)

## Configuration Fields

### Environment Variables

Set environment variables available to all DAG steps:

```yaml
# base.yaml
env:
  - TZ=UTC
  - ENVIRONMENT=production
  - LOG_LEVEL=info
  - SLACK_WEBHOOK=${SLACK_WEBHOOK_URL}  # Expand from OS env
```

Environment variables from base config are **appended** to those defined in individual DAGs, allowing you to set common defaults while DAGs add their specific variables.

Child DAG `env:` entries can reference inherited base env values, and evaluated param defaults can reference the merged result.

```yaml
# base.yaml
env:
  - BASE_DIR: /srv/shared
eval_params: true

# report.yaml
env:
  - REPORT_DIR: "${BASE_DIR}/reports"
params:
  - OUTPUT: "${REPORT_DIR}/daily.csv"
```

This resolves `REPORT_DIR` from the inherited base env, then resolves `OUTPUT` from the child DAG env because `eval_params` was inherited from `base.yaml`.

### Lifecycle Handlers

Define handlers that run on specific events for all DAGs:

```yaml
# base.yaml
handler_on:
  init:
    command: echo "Starting DAG ${DAG_NAME}"

  success:
    command: |
      curl -X POST ${SLACK_WEBHOOK} \
        -d '{"text":"✅ ${DAG_NAME} completed successfully"}'

  failure:
    command: |
      curl -X POST ${SLACK_WEBHOOK} \
        -d '{"text":"❌ ${DAG_NAME} failed! Run ID: ${DAG_RUN_ID}"}'

  exit:
    command: echo "Cleanup complete"
```

**Available handler types:**

| Handler | Trigger |
|---------|---------|
| `init` | Before steps execute (after preconditions pass) |
| `success` | All steps completed successfully |
| `failure` | Any step failed |
| `abort` | DAG was cancelled |
| `exit` | Always runs on completion (cleanup) |
| `wait` | DAG enters wait status (approval step pending) |

**Special environment variables** available in handlers:

| Variable | Description |
|----------|-------------|
| `DAG_NAME` | Name of the executing DAG |
| `DAG_RUN_ID` | Unique identifier for this run |
| `DAG_RUN_LOG_FILE` | Path to the log file |
| `DAG_RUN_STATUS` | Current status (running, success, failed) |
| `DAG_RUN_STEP_NAME` | Name of the handler step |

### Email Notifications

Configure SMTP and email alerts for all DAGs:

```yaml
# base.yaml
smtp:
  host: smtp.sendgrid.net
  port: 587
  username: apikey
  password: ${SENDGRID_API_KEY}

mail_on:
  failure: true
  success: false
  wait: false

error_mail:
  from: dagu@mycompany.com
  to:
    - ops-team@mycompany.com
    - oncall@mycompany.com
  prefix: "[DAGU ALERT]"
  attach_logs: true

info_mail:
  from: dagu@mycompany.com
  to:
    - team@mycompany.com

wait_mail:
  from: dagu@mycompany.com
  to:
    - approvers@mycompany.com
  prefix: "[APPROVAL REQUIRED]"
```

### Execution Defaults

Set default execution parameters:

```yaml
# base.yaml
# Default shell for all steps
shell: "bash"
# Or with arguments:
# shell: ["bash", "-e", "-o", "pipefail"]

# Working directory (default: DAG file location)
working_dir: "/app/workflows"

# Maximum execution time (seconds)
timeout_sec: 3600

# Delay before starting (seconds)
delay_sec: 0

# Wait time before restart (seconds)
restart_wait_sec: 60

# Max concurrent DAG runs (per DAG)
max_active_runs: 1

# Max concurrent steps within a run
max_active_steps: 4

# History retention (days)
hist_retention_days: 30

# Cleanup timeout when stopped (seconds, default 5)
max_clean_up_time_sec: 60

# Max step output capture size (bytes, default 1MB)
max_output_size: 1048576
```

### Logging

Configure log output behavior:

```yaml
# base.yaml
# Custom log directory
log_dir: /var/log/dagu

# Log output mode:
# - "separate": stdout/stderr in separate files (.out, .err)
# - "merged": combined into single file (.log)
log_output: merged
```

### External Service Defaults

#### SSH Configuration

```yaml
# base.yaml
ssh:
  user: deploy
  host: ""  # Set per-DAG or per-step
  port: 22
  key: ~/.ssh/deploy_key
  strict_host_key: true
  known_host_file: ~/.ssh/known_hosts
  shell: bash
```

#### S3 Configuration

```yaml
# base.yaml
s3:
  region: us-east-1
  bucket: my-data-bucket
  # For S3-compatible services (MinIO, etc.)
  endpoint: ""
  force_path_style: false
  # Credentials (prefer IAM roles in production)
  access_key_id: ${AWS_ACCESS_KEY_ID}
  secret_access_key: ${AWS_SECRET_ACCESS_KEY}
```

#### LLM Configuration

```yaml
# base.yaml
llm:
  provider: openai
  model: gpt-4
  temperature: 0.7
  max_tokens: 4096
  # API key from environment
  api_key_name: OPENAI_API_KEY
```

#### Redis Configuration

```yaml
# base.yaml
redis:
  host: localhost
  port: 6379
  password: ${REDIS_PASSWORD}
  db: 0
  tls: false
```

### Container Defaults

Set default Docker container configuration:

```yaml
# base.yaml
container:
  image: python:3.11-slim
  pull_policy: IfNotPresent
  working_dir: /app
  env:
    - PYTHONUNBUFFERED=1
  volumes:
    - /data:/data:ro
```

Registry authentication:

```yaml
# base.yaml
registry_auths:
  ghcr.io:
    username: ${GITHUB_USER}
    password: ${GITHUB_TOKEN}
  docker.io:
    auth: ${DOCKER_AUTH_BASE64}
```

### Queue & Worker Settings

Configure distributed execution defaults:

```yaml
# base.yaml
# Assign DAGs to a specific queue
queue: default

# Require specific worker labels
worker_selector:
  region: us-east
  capability: gpu
```

To force local execution for a specific DAG (overriding `default_execution_mode: distributed`):

```yaml
# my-local-dag.yaml
worker_selector: local
steps:
  - command: echo "Always runs locally"
```

### Preconditions

Set global preconditions that all DAGs must satisfy:

```yaml
# base.yaml
preconditions:
  - condition: "test -f /data/system-ready"
    expected: "true"
```

### Secrets

Reference external secrets:

```yaml
# base.yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: SECRET_DB_PASSWORD

  - name: API_KEY
    provider: file
    key: /run/secrets/api_key
```

### OpenTelemetry

Configure tracing for all DAGs:

```yaml
# base.yaml
otel:
  enabled: true
  endpoint: http://otel-collector:4317
  insecure: true
  headers:
    Authorization: Bearer ${OTEL_TOKEN}
```

### Run Configuration

Control UI behavior:

```yaml
# base.yaml
run_config:
  disable_param_edit: false   # Prevent parameter editing in UI
  disable_run_id_edit: false   # Prevent custom run ID input
```

## Complete Example

A production-ready base configuration:

```yaml
# ~/.config/dagu/base.yaml

# Environment defaults
env:
  - TZ=UTC
  - ENVIRONMENT=production
  - LOG_LEVEL=info

# Execution limits
timeout_sec: 3600
hist_retention_days: 30
max_active_runs: 1
max_clean_up_time_sec: 30

# Logging
log_output: merged

# Shell with strict mode
shell: ["bash", "-e", "-o", "pipefail"]

# Lifecycle handlers for alerting
handler_on:
  failure:
    command: |
      curl -s -X POST "${SLACK_WEBHOOK}" \
        -H "Content-Type: application/json" \
        -d '{
          "text": "❌ DAG Failed",
          "blocks": [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "*DAG Failed*\n• Name: `'"${DAG_NAME}"'`\n• Run ID: `'"${DAG_RUN_ID}"'`"
              }
            }
          ]
        }'

  exit:
    command: |
      # Cleanup temp files
      rm -rf /tmp/dagu-${DAG_RUN_ID}-* 2>/dev/null || true

# Email notifications
smtp:
  host: smtp.sendgrid.net
  port: 587
  username: apikey
  password: ${SENDGRID_API_KEY}

mail_on:
  failure: true

error_mail:
  from: dagu@mycompany.com
  to:
    - platform-team@mycompany.com
  prefix: "[DAGU]"
  attach_logs: true

# SSH defaults for deployment servers
ssh:
  user: deploy
  key: ~/.ssh/deploy_key
  strict_host_key: true

# S3 defaults for data pipelines
s3:
  region: us-east-1
  bucket: company-data-lake
```

## Common Patterns

### Team-wide Failure Alerting

```yaml
# base.yaml
env:
  - PAGERDUTY_KEY=${PAGERDUTY_ROUTING_KEY}

handler_on:
  failure:
    command: |
      curl -X POST https://events.pagerduty.com/v2/enqueue \
        -H "Content-Type: application/json" \
        -d '{
          "routing_key": "'"${PAGERDUTY_KEY}"'",
          "event_action": "trigger",
          "payload": {
            "summary": "DAG '"${DAG_NAME}"' failed",
            "severity": "error",
            "source": "dagu"
          }
        }'
```

### Environment-specific Configuration

Use different base configs per environment:

```bash
# Development
export DAGU_BASE_CONFIG=/etc/dagu/base-dev.yaml

# Production
export DAGU_BASE_CONFIG=/etc/dagu/base-prod.yaml
```

### Shared Database Credentials

```yaml
# base.yaml
env:
  - DB_HOST=postgres.internal
  - DB_PORT=5432
  - DB_NAME=analytics

secrets:
  - name: DB_PASSWORD
    provider: env
    key: POSTGRES_PASSWORD
```

## Handler Inheritance in Sub-DAGs

When a DAG invokes another DAG (sub-DAG), handler inheritance is controlled automatically:

- **Main DAG execution**: Inherits handlers from base config
- **Sub-DAG execution**: Handlers from base config are **skipped** by default

This prevents duplicate notifications when a parent DAG's failure handler would trigger alongside a child's.

To define handlers for a sub-DAG, add them explicitly in the sub-DAG file:

```yaml
# sub-dag.yaml
handler_on:
  failure:
    command: echo "Sub-DAG specific failure handling"

steps:
  - id: process
    command: ./process.sh
```

## See Also

- [Server Configuration](/server-admin/server) - Configure the Dagu server
- [Environment Variables](/writing-workflows/environment-variables) - Variable handling in workflows
- [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) - Handler details
- [Email Notifications](/writing-workflows/email-notifications) - Email setup guide
- [Configuration Reference](/server-admin/reference) - Complete field reference
