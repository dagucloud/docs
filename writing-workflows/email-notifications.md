# Email Notifications

Dagu provides built-in email notifications for workflow events and errors.

## SMTP Configuration

### Global Configuration

Set up SMTP settings in your Dagu configuration:

```yaml
# ~/.config/dagu/config.yaml
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

### Environment Variables

Configure SMTP via environment:

```bash
export DAGU_SMTP_HOST=smtp.gmail.com
export DAGU_SMTP_PORT=587
export DAGU_SMTP_USERNAME=alerts@example.com
export DAGU_SMTP_PASSWORD=secret-password

export DAGU_ERROR_MAIL_FROM=alerts@example.com
export DAGU_ERROR_MAIL_TO=team@example.com
export DAGU_ERROR_MAIL_PREFIX="[Alert]"
```

## DAG-Level Configuration

Override global settings per DAG:

```yaml
# my-dag.yaml
smtp:
  host: smtp.company.com
  port: "465"
  username: ${SMTP_USER}
  password: ${SMTP_PASS}

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
    command: process_critical_data.sh
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

## Mail Step Type

Send custom emails as workflow steps:

```yaml
steps:
  - id: send_report
    type: mail
    with:
      to:
        - reports@example.com
        - archive@example.com
      from: noreply@example.com
      subject: "Daily Report - ${TODAY}"
      message: |
        Daily processing report for ${TODAY}

        Summary:
        - Records processed: ${RECORD_COUNT}
        - Success rate: ${SUCCESS_RATE}%
        - Processing time: ${DURATION}

        See attached files for details.
      attachments:
        - /reports/daily-${TODAY}.pdf
        - /reports/summary-${TODAY}.csv
        - ${DAG_RUN_LOG_FILE}
```

## Email Templates

### Processing Report

```yaml
steps:
  - id: generate_report
    command: generate_report.py
    output: REPORT_PATH

  - id: email_report
    type: mail
    with:
      to: stakeholders@example.com
      subject: "Processing Report - ${DAG_NAME}"
      message: |
        Automated Report Generated

        DAG: ${DAG_NAME}
        Run ID: ${DAG_RUN_ID}
        Status: Completed
        Time: $(date)

        Report available at: ${REPORT_PATH}
      attachments:
        - command: ${REPORT_PATH}
```

### Error Notification

```yaml
handler_on:
  failure:
    type: mail
    with:
      to:
        - oncall@example.com
        - alerts@example.com
      from: errors@example.com
      subject: "⚠️ DAG Failed: ${DAG_NAME}"
      message: |
        DAG Execution Failed

        Details:
        - DAG: ${DAG_NAME}
        - Run ID: ${DAG_RUN_ID}
        - Time: $(date)
        - Host: $(hostname)

        Error Summary:
        $(tail -20 ${DAG_RUN_LOG_FILE} | grep -i error)

        Full log attached.
      attachments:
        - ${DAG_RUN_LOG_FILE}
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
  password: ${SENDGRID_API_KEY}
```

### AWS SES

```yaml
smtp:
  host: email-smtp.us-east-1.amazonaws.com
  port: "587"
  username: ${AWS_SES_SMTP_USERNAME}
  password: ${AWS_SES_SMTP_PASSWORD}
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
steps:
  - id: check_environment
    command: echo $ENVIRONMENT
    output: ENV

  - id: notify
    type: mail
    with:
      to: |
        `if [ "${ENV}" = "production" ]; then
          echo "prod-alerts@example.com"
        else
          echo "dev-alerts@example.com"
        fi`
      subject: "Alert from ${ENV}"
      message: "Environment-specific alert"
```

### HTML Emails

```yaml
steps:
  - id: send_html_email
    type: mail
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
              <td>${RECORD_COUNT}</td>
            </tr>
          </table>
        </body>
        </html>
      headers:
        Content-Type: text/html
```
