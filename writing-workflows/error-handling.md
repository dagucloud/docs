# Error Handling

Build resilient workflows with retries, handlers, and notifications.

## Retry Policies

### Basic Retry

```yaml
steps:
  # Basic retry with fixed interval
  - command: curl https://api.example.com
    retry_policy:
      limit: 3
      interval_sec: 5
      
  # Retry specific errors
  - command: make-request
    retry_policy:
      limit: 3
      interval_sec: 30
      exit_code: [429, 503]  # Rate limit or unavailable
```

### Exponential Backoff

Increase retry intervals exponentially to avoid overwhelming failed services:

```yaml
steps:
  # Exponential backoff with default multiplier (2.0)
  - command: curl https://api.example.com/data
    retry_policy:
      limit: 5
      interval_sec: 2
      backoff: true        # true = 2.0 multiplier
      # Intervals: 2s, 4s, 8s, 16s, 32s
      
  # Custom backoff multiplier
  - command: echo "Checking service health"
    retry_policy:
      limit: 4
      interval_sec: 1
      backoff: 1.5         # Custom multiplier
      # Intervals: 1s, 1.5s, 2.25s, 3.375s
      
  # Backoff with max interval cap
  - command: echo "Syncing data"
    retry_policy:
      limit: 10
      interval_sec: 1
      backoff: 2.0
      max_interval_sec: 30   # Cap at 30 seconds
      # Intervals: 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s...
```

**Backoff Formula**: `interval * (backoff ^ attemptCount)`

**Note**: Backoff values must be greater than 1.0 for exponential growth.

## Continue On Conditions

Control workflow execution flow when steps encounter errors or specific conditions.

### Basic Usage

```yaml
steps:
  # Continue on any failure (shorthand)
  - command: rm -f /tmp/cache/*
    continue_on: failed

  # Continue on specific exit codes
  - command: echo "Checking status"
    continue_on:
      exit_code: [0, 1, 2]  # 0=success, 1=warning, 2=info

  # Continue on output patterns
  - command: validate.sh
    continue_on:
      output:
        - command: "WARNING"
        - command: "SKIP"
        - command: "re:^INFO:.*"      # Regex pattern
        - command: "re:WARN-[0-9]+"   # Another regex

  # Mark as success when continuing
  - command: optimize.sh
    continue_on:
      failure: true
      mark_success: true  # Shows as successful in UI
```

### Advanced Patterns

```yaml
steps:
  # Database migration with known warnings
  - command: echo "Running migration"
    continue_on:
      output:
        - command: "re:WARNING:.*already exists"
        - command: "re:NOTICE:.*will be created"
      exit_code: [0, 1]
      
  # Service health check with fallback
  - command: curl -f https://primary.example.com/health
    continue_on:
      exit_code: [0, 22, 7]  # 22=HTTP error, 7=connection failed
      
  # Conditional cleanup
  - command: find /tmp -name "*.tmp" -mtime +7 -delete
    continue_on:
      failure: true       # Continue even if cleanup fails
      exit_code: [0, 1]   # find returns 1 if no files found
      
  # Tool with non-standard exit codes
  - command: security-scanner --strict
    continue_on:
      exit_code: [0, 4, 8]  # 0=clean, 4=warnings, 8=info
      output:
        - command: "re:LOW SEVERITY:"
        - command: "re:INFORMATIONAL:"
```

See the [Continue On Reference](/reference/continue-on) for complete documentation.

## Lifecycle Handlers

Lifecycle handlers fire after the main steps complete and let you add notifications or cleanup logic based on the final DAG status. See the [Lifecycle Handlers guide](/writing-workflows/lifecycle-handlers) for execution order, context access, and additional patterns. Quick examples:

```yaml
handler_on:
  init:
    command: setup-environment.sh  # Runs before any steps
  success:
    command: notify-success.sh
  failure:
    command: alert-oncall.sh "${DAG_NAME} failed"
  abort:
    command: cleanup.sh
  exit:
    command: rm -rf /tmp/dag-${DAG_RUN_ID}  # Always runs

# With email
handler_on:
  failure:
    type: mail
    config:
      to: oncall@company.com
      from: dagu@company.com
      subject: "Failed: ${DAG_NAME}"
      message: "Check logs: ${DAG_RUN_LOG_FILE}"
```

## Email Notifications

```yaml
# Global configuration
smtp:
  host: "smtp.gmail.com"
  port: "587"
  username: "${SMTP_USER}"
  password: "${SMTP_PASS}"

mail_on:
  failure: true
  success: false

error_mail:
  from: "dagu@company.com"
  to: "oncall@company.com"
  prefix: "[ALERT]"
  attach_logs: true

# Step-level
steps:
  - command: backup.sh
    mail_on_error: true
    
  # Send custom email
  - type: mail
    config:
      to: team@company.com
      from: dagu@company.com
      subject: "Report Ready"
      message: "See attached"
      attachments:
        - /tmp/report.pdf
```

## Timeouts and Cleanup

```yaml
# DAG timeout
timeout_sec: 3600  # 1 hour

# Cleanup timeout
max_clean_up_time_sec: 300  # 5 minutes

steps:
  # Step with graceful shutdown
  - command: server.sh
    signal_on_stop: SIGTERM  # Default

  # Always cleanup
  - command: analyze.sh
    continue_on: failed

  - command: cleanup.sh  # Runs even if process fails
```
