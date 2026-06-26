# Email Notifications

Dagu provides built-in email notifications for workflow events and errors.

::: tip Web UI notification routing
For team-wide Slack, email, Telegram, and webhook routing from the Web UI, use [Notifications](/web-ui/notifications).

For PagerDuty or SolarWinds incidents that open on final failure and resolve on recovery, use [Incident Routing](/web-ui/incidents). Web UI incident routing requires an active Dagu license or trial on self-hosted deployments.
:::

The YAML fields on this page are useful when you want email behavior to travel with a DAG or base configuration. Web UI notification rules are better when operators should manage channels and event routing without editing DAG YAML.

## SMTP Configuration

### Base Configuration

Set up SMTP defaults in the base configuration inherited by DAGs:

```yaml
# ~/.config/dagu/base.yaml
smtp:
  host: smtp.gmail.com
  port: "587"
  username: alerts@example.com
  password: app-specific-password
  
error_mail:
  from: alerts@example.com
  to: team@example.com  # Single recipient (string format)
  prefix: "[Dagu Alert]"
  attach_logs: true
```

### Credentials From Environment Or Secrets

`smtp`, `error_mail`, `info_mail`, and `wait_mail` are DAG/base-config fields. They are not read from server-level `DAGU_*` SMTP or mail environment variables.

If SMTP credentials come from the process environment, import them into DAG scope with `env:` or `secrets:` and reference the scoped variables from `smtp`:

```yaml
env:
  - SMTP_USER: ${SMTP_USER}
  - SMTP_PASS: ${SMTP_PASS}

smtp:
  host: smtp.gmail.com
  port: "587"
  username: "${env.SMTP_USER}"
  password: "${env.SMTP_PASS}"
```

For Web UI-managed notification rules, configure email delivery from [Notifications](/web-ui/notifications) instead of DAG YAML.

## DAG-Level Configuration

Override global settings per DAG:

```yaml
# my-dag.yaml
smtp:
  host: smtp.company.com
  port: "465"
  username: ${env.SMTP_USER}
  password: ${env.SMTP_PASS}

error_mail:
  from: dagu@company.com
  to: 
    - oncall@company.com
    - manager@company.com
  prefix: "[CRITICAL]"
  attach_logs: true

mail_on:
  success: true
  failure: true
  wait: true

wait_mail:
  from: dagu@company.com
  to:
    - approvers@company.com
  prefix: "[WAITING]"
  attach_logs: false
```

## Email Triggers

### Success/Failure/Wait Emails

```yaml
mail_on:
  success: true    # Email on successful completion
  failure: true    # Email on failure
  wait: true       # Email when waiting for human approval
```

### Step-Level Errors

```yaml
steps:
  - id: critical_step
    run: process_critical_data.sh
    mail_on_error: true  # Email if this step fails
```

### Wait Status Notifications

Send notifications when a DAG is waiting for human approval:

```yaml
mail_on:
  wait: true

wait_mail:
  from: dagu@company.com
  to:
    - approvers@company.com
  prefix: "[APPROVAL REQUIRED]"
  attach_logs: false
```

This is useful for workflows that require human approval before continuing execution. The email will include details about the DAG and which steps are waiting.

## Mail Action

Send custom emails as workflow steps:

```yaml
steps:
  - id: send_report
    action: mail.send
    with:
      to:
        - reports@example.com
        - archive@example.com
      from: noreply@example.com
      subject: "Daily Report - ${env.TODAY}"
      message: |
        Daily processing report for ${env.TODAY}

        Summary:
        - Records processed: ${env.RECORD_COUNT}
        - Success rate: ${env.SUCCESS_RATE}%
        - Processing time: ${env.DURATION}

        See attached files for details.
      attachments:
        - /reports/daily-${env.TODAY}.pdf
        - /reports/summary-${env.TODAY}.csv
        - ${context.paths.log_file}
```

## Email Templates

### Processing Report

```yaml
steps:
  - id: generate_report
    run: |
      report_path="/tmp/report.pdf"
      generate_report.py > "$report_path"
      printf 'report_path=%s\n' "$report_path" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: report_path

  - id: email_report
    action: mail.send
    with:
      to: stakeholders@example.com
      subject: "Processing Report - ${context.dag.name}"
      message: |
        Automated Report Generated

        DAG: ${context.dag.name}
        Run ID: ${context.run.id}
        Status: Completed
        Time: $(date)

        Report available at: ${steps.generate_report.outputs.report_path}
      attachments:
        - run: ${steps.generate_report.outputs.report_path}
    depends: generate_report
```

### Error Notification

```yaml
handler_on:
  failure:
    action: mail.send
    with:
      to:
        - oncall@example.com
        - alerts@example.com
      from: errors@example.com
      subject: "DAG Failed: ${context.dag.name}"
      message: |
        DAG Execution Failed

        Details:
        - DAG: ${context.dag.name}
        - Run ID: ${context.run.id}
        - Time: $(date)
        - Host: $(hostname)

        Error Summary:
        $(tail -20 ${context.paths.log_file} | grep -i error)

        Full log attached.
      attachments:
        - ${context.paths.log_file}
```

## SMTP Providers

### Gmail

```yaml
smtp:
  host: smtp.gmail.com
  port: "587"
  username: your-email@gmail.com
  password: app-specific-password  # Use app password, not regular password
```

### Office 365

```yaml
smtp:
  host: smtp.office365.com
  port: "587"
  username: your-email@company.com
  password: your-password
```

### SendGrid

```yaml
smtp:
  host: smtp.sendgrid.net
  port: "587"
  username: apikey
  password: ${env.SENDGRID_API_KEY}
```

### AWS SES

```yaml
smtp:
  host: email-smtp.us-east-1.amazonaws.com
  port: "587"
  username: ${env.AWS_SES_SMTP_USERNAME}
  password: ${env.AWS_SES_SMTP_PASSWORD}
```

## Advanced Configuration

### Multiple Recipients

```yaml
error_mail:
  to:
    - primary@example.com
    - secondary@example.com
    - team-alerts@example.com
```

### Conditional Recipients

```yaml
params:
  - name: environment
    default: development

steps:
  - id: notify
    action: mail.send
    with:
      to: |
        `if [ "${params.environment}" = "production" ]; then
          echo "prod-alerts@example.com"
        else
          echo "dev-alerts@example.com"
        fi`
      subject: "Alert from ${params.environment}"
      message: "Environment-specific alert"
```

### HTML Emails

```yaml
steps:
  - id: send_html_email
    action: mail.send
    with:
      to: reports@example.com
      subject: "HTML Report"
      message: |
        <html>
        <body>
          <h1>Daily Report</h1>
          <table border="1">
            <tr>
              <td>Status</td>
              <td style="color: green;">Success</td>
            </tr>
            <tr>
              <td>Records</td>
              <td>${env.RECORD_COUNT}</td>
            </tr>
          </table>
        </body>
        </html>
      headers:
        Content-Type: text/html
```
