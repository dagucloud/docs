# Mail

Send emails from your workflows for notifications, alerts, and reports.

## Basic Usage

```yaml
smtp:
  host: "smtp.gmail.com"
  port: "587"
  username: "${env.SMTP_USER}"
  password: "${env.SMTP_PASS}"

steps:
  - action: mail.send
    with:
      to: recipient@example.com
      from: sender@example.com
      subject: "Workflow Completed"
      message: "The data processing workflow has completed successfully."
```

## SMTP Configuration

Configure SMTP at DAG-level for all mail steps. For global configuration, see [Email Notifications](/writing-workflows/email-notifications#smtp-configuration).

### Common Providers

```yaml
# Gmail
smtp:
  host: "smtp.gmail.com"
  port: "587"
  username: "your-email@gmail.com"
  password: "app-specific-password"  # Not regular password

# Office 365
smtp:
  host: "smtp.office365.com"
  port: "587"
  username: "${env.SMTP_USER}"
  password: "${env.SMTP_PASS}"

# AWS SES
smtp:
  host: "email-smtp.us-east-1.amazonaws.com"
  port: "587"
  username: "${env.AWS_SES_SMTP_USER}"
  password: "${env.AWS_SES_SMTP_PASSWORD}"
```

### Variable Expansion

Scoped references in `smtp` fields expand DAG-scoped values. OS environment variables are **not** expanded directly. If your SMTP credentials come from the OS environment, import them in the `env:` block:

```yaml
env:
  - SMTP_USER: ${SMTP_USER}  # Import from OS environment
  - SMTP_PASS: ${SMTP_PASS}

smtp:
  host: "smtp.gmail.com"
  port: "587"
  username: "${env.SMTP_USER}"
  password: "${env.SMTP_PASS}"
```

## Examples

### Multiple Recipients

```yaml
steps:
  - action: mail.send
    with:
      to:
        - team@example.com
        - manager@example.com
        - stakeholders@example.com
      from: noreply@example.com
      subject: "Daily Report Ready"
      message: "The daily report has been generated."

  - action: mail.send
    with:
      to: admin@example.com  # Single recipient still works
      from: system@example.com
      subject: "System Update"
      message: "System maintenance completed."
```

### With Variables

```yaml
params:
  - ENVIRONMENT: production
  - VERSION: v1.2.3

steps:
  - action: mail.send
    with:
      to: devops@company.com
      from: deploy@company.com
      subject: "Deployed to ${params.ENVIRONMENT}"
      message: |
        Deployment completed:
        - Environment: ${params.ENVIRONMENT}
        - Version: ${params.VERSION}
        - Time: `date`
```

### Success/Failure Notifications

```yaml
handler_on:
  success:
    action: mail.send
    with:
      to: team@company.com
      from: dagu@company.com
      subject: "Pipeline Success - ${env.DAG_NAME}"
      message: |
        Pipeline completed successfully.
        Run ID: ${env.DAG_RUN_ID}
        Logs: ${env.DAG_RUN_LOG_FILE}

  failure:
    action: mail.send
    with:
      to: oncall@company.com
      from: alerts@company.com
      subject: "Pipeline Failed - ${env.DAG_NAME}"
      message: |
        Pipeline failed.
        Run ID: ${env.DAG_RUN_ID}
        Check logs: ${env.DAG_RUN_LOG_FILE}

steps:
  - run: echo "Run your main tasks here"
```

### Error Alerts

```yaml
error_mail:
  from: alerts@company.com
  to: oncall@company.com
  prefix: "[CRITICAL]"
  attach_logs: true

steps:
  - run: echo "Run some critical task"
    mail_on_error: true
```

### With Attachments

```yaml
steps:
  - id: generate_report
    run: echo "Generating report..." > report.txt

  - id: send_report
    action: mail.send
    with:
      to: management@company.com
      from: reports@company.com
      subject: "Weekly Report"
      message: "Please find the weekly report attached."
      attachments:
        - report.txt
    depends: generate_report
```

### With Retry

```yaml
steps:
  - action: mail.send
    with:
      to: oncall@company.com
      from: alerts@company.com
      subject: "Critical Alert"
      message: "Immediate action required."
    retry_policy:
      limit: 3
      interval_sec: 60
```
