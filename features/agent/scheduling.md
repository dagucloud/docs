# Scheduled Agents

Agent steps work with `schedule` like any other step type. Add a `schedule` field to a DAG containing `type: agent` steps to run them on a cron schedule.

## Prerequisites

- The scheduler must be running (`dagu scheduler` or `dagu start-all`)
- An agent model must be configured in Agent Settings (`/settings/agent`)
- See [Scheduling](/features/scheduling) for cron syntax and scheduler setup
- See [Agent Step](/features/agent/step) for agent configuration

## Basic Example

A daily agent that summarizes system health:

```yaml
schedule: "0 8 * * *"  # Every day at 8 AM

steps:
  - name: health-check
    type: agent
    messages:
      - role: user
        content: |
          Check the system health by reviewing /var/log/syslog and
          report any errors or warnings from the last 24 hours.
    output: HEALTH_REPORT
```

## Parameters

Parameters are defined at the DAG level. The same values apply to every scheduled run. Use `${VAR}` syntax in message content:

```yaml
schedule: "0 9 * * MON-FRI"

params:
  - LOG_DIR=/var/log/app
  - THRESHOLD=100

steps:
  - name: check-errors
    type: agent
    messages:
      - role: user
        content: |
          Scan all log files in ${LOG_DIR} for error counts.
          Flag any file with more than ${THRESHOLD} errors in the last 24 hours.
    output: ERROR_REPORT
```

To run with different parameter values, trigger the DAG manually or create separate DAG files.

## Output Capture

The agent writes its result via the `output` tool, which is captured by the step's `output` field. Chain agent output to subsequent steps:

```yaml
schedule: "0 6 * * *"

steps:
  - name: analyze
    type: agent
    messages:
      - role: user
        content: "Analyze yesterday's deployment logs and summarize any issues."
    output: ANALYSIS

  - name: send-report
    command: |
      echo "${ANALYSIS}" | mail -s "Daily Deployment Report" team@example.com
    depends: [analyze]
```

If the agent never calls the `output` tool, the output variable will be empty.

## Catchup

When the scheduler restarts after downtime, `catchup_window` replays missed runs. Each missed interval triggers a full agent run, so be mindful of LLM API costs:

```yaml
schedule: "0 * * * *"          # Hourly
catchup_window: "6h"           # Replay up to 6 hours of missed runs
overlap_policy: "skip"         # Skip if previous catchup run is still active

steps:
  - name: hourly-monitor
    type: agent
    messages:
      - role: user
        content: "Check application metrics for the last hour and flag anomalies."
    output: MONITOR_RESULT
```

| `overlap_policy` | Behavior |
|-------------------|----------|
| `"skip"` (default) | Drop the catchup run if the DAG is still running |
| `"all"` | Keep the run in the buffer, retry next tick |
| `"latest"` | Discard all but the most recent missed interval |

## Queue Control

Agent steps can be long-running and expensive (LLM API calls). Use `queue` to limit concurrent scheduled agent runs:

```yaml
schedule: "*/30 * * * *"
queue: agent-tasks

steps:
  - name: review
    type: agent
    messages:
      - role: user
        content: "Review open pull requests and summarize their status."
    output: PR_SUMMARY
```

Configure the queue in your Dagu config:

```yaml
# ~/.config/dagu/config.yaml
queues:
  enabled: true
  config:
    - name: agent-tasks
      max_concurrency: 1  # Only one agent run at a time
```

## Examples

### Daily Log Analysis Agent

```yaml
schedule: "0 7 * * *"

steps:
  - name: analyze-logs
    type: agent
    messages:
      - role: user
        content: |
          Analyze /var/log/app/errors.log from the last 24 hours.
          Categorize errors by type and severity.
          Suggest fixes for the top 3 most frequent errors.
    output: LOG_ANALYSIS
```

### Agent Pipeline (Agent to Shell Step)

```yaml
schedule: "0 9 * * MON"

steps:
  - name: generate-report
    type: agent
    messages:
      - role: user
        content: |
          Review the Git commit history for the past week.
          Write a concise weekly summary in Markdown format.
    output: WEEKLY_SUMMARY

  - name: save-report
    command: echo "${WEEKLY_SUMMARY}" > /reports/weekly-$(date +%Y-%m-%d).md
    depends: [generate-report]
```

### Scheduled Agent with Restricted Tools and Bash Policy

```yaml
schedule: "0 */6 * * *"

steps:
  - name: security-scan
    type: agent
    agent:
      tools:
        enabled:
          - bash
          - read
          - think
        bash_policy:
          default_behavior: deny
          deny_behavior: block
          rules:
            - name: allow-read-commands
              pattern: "^(cat|head|tail|grep|find|ls|wc|stat)\\b"
              action: allow
            - name: allow-network-checks
              pattern: "^(curl -s|ping -c|nslookup|dig)\\b"
              action: allow
      max_iterations: 30
    messages:
      - role: user
        content: |
          Run a security check:
          1. Check for world-readable files in /etc
          2. Verify no unexpected ports are open
          3. Check for failed SSH login attempts
    output: SECURITY_REPORT
```

### Graph DAG with Multiple Agent Steps

```yaml
schedule: "0 6 * * MON-FRI"
type: graph

steps:
  - name: check-infra
    type: agent
    messages:
      - role: user
        content: "Check disk usage, memory, and CPU across all servers."
    output: INFRA_STATUS

  - name: check-app
    type: agent
    messages:
      - role: user
        content: "Review application health endpoints and response times."
    output: APP_STATUS

  - name: summarize
    type: agent
    messages:
      - role: user
        content: |
          Combine these reports into a single morning briefing:

          Infrastructure: ${INFRA_STATUS}
          Application: ${APP_STATUS}
    depends: [check-infra, check-app]
    output: MORNING_BRIEF
```

The `check-infra` and `check-app` steps run in parallel. The `summarize` step waits for both to finish before combining their outputs.

## See Also

- [Scheduling](/features/scheduling) — Cron syntax, catchup, overlap policy, queue management
- [Agent Step](/features/agent/step) — Agent configuration, tools, bash policy, output capture
- [Tools Reference](/features/agent/tools) — Full parameter documentation for each tool
- [Memory](/features/agent/memory) — Persistent agent memory across sessions
