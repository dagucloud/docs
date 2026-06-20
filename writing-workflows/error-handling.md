# Error Handling

Use `continue_on`, handlers, and mail settings to control what happens after a step fails or a DAG finishes.

Automatic retries are documented in [Durable Execution](/writing-workflows/durable-execution). That page covers:

- `steps[].retry_policy`
- `defaults.retry_policy`
- root `retry_policy`
- scheduler requirements for DAG-level retry

## Continue On Conditions

Control workflow execution flow when steps encounter errors or specific conditions.

### Basic Usage

```yaml
steps:
  # Continue on any failure (shorthand)
  - run: rm -f /tmp/cache/*
    continue_on: failed

  # Continue on specific exit codes
  - run: echo "Checking status"
    continue_on:
      exit_code: [0, 1, 2]  # 0=success, 1=warning, 2=info

  # Continue on output patterns
  - run: validate.sh
    continue_on:
      output:
        - "WARNING"
        - "SKIP"
        - "re:^INFO:.*"      # Regex pattern
        - "re:WARN-[0-9]+"   # Another regex

  # Mark as success when continuing
  - run: optimize.sh
    continue_on:
      failure: true
      mark_success: true  # Shows as successful in UI
```

### Advanced Patterns

```yaml
steps:
  # Database migration with known warnings
  - run: echo "Running migration"
    continue_on:
      output:
        - "re:WARNING:.*already exists"
        - "re:NOTICE:.*will be created"
      exit_code: [0, 1]
      
  # Service health check with fallback
  - run: curl -f https://primary.example.com/health
    continue_on:
      exit_code: [0, 22, 7]  # 22=HTTP error, 7=connection failed
      
  # Conditional cleanup
  - run: find /tmp -name "*.tmp" -mtime +7 -delete
    continue_on:
      failure: true       # Continue even if cleanup fails
      exit_code: [0, 1]   # find returns 1 if no files found
      
  # Tool with non-standard exit codes
  - run: security-scanner --strict
    continue_on:
      exit_code: [0, 4, 8]  # 0=clean, 4=warnings, 8=info
      output:
        - "re:LOW SEVERITY:"
        - "re:INFORMATIONAL:"
```

See the [Continue On Reference](/writing-workflows/continue-on) for complete documentation.

## Lifecycle Handlers

Lifecycle handlers fire after the main steps complete and let you add notifications or cleanup logic based on the final DAG status. See the [Lifecycle Handlers guide](/writing-workflows/lifecycle-handlers) for execution order, context access, and additional patterns. Quick examples:

```yaml
handler_on:
  init:
    run: setup-environment.sh  # Runs before any steps
  success:
    run: notify-success.sh
  failure:
    run: alert-oncall.sh "${env.DAG_NAME} failed"
  abort:
    run: cleanup.sh
  exit:
    run: rm -rf "/tmp/dag-${env.DAG_RUN_ID}"  # Always runs

# With email
handler_on:
  failure:
    action: mail.send
    with:
      to: oncall@company.com
      from: dagu@company.com
      subject: "Failed: ${env.DAG_NAME}"
      message: "Check logs: ${env.DAG_RUN_LOG_FILE}"
```

## Email Notifications

```yaml
# Global configuration
smtp:
  host: "smtp.gmail.com"
  port: "587"
  username: "${env.SMTP_USER}"
  password: "${env.SMTP_PASS}"

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
  - run: backup.sh
    mail_on_error: true
    
  # Send custom email
  - action: mail.send
    with:
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
  - run: server.sh
    signal_on_stop: SIGTERM  # Default

  # Always cleanup
  - run: analyze.sh
    continue_on: failed

  - run: cleanup.sh  # Runs even if process fails
```
