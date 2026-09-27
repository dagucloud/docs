# Mail

Send emails from your workflows for notifications, alerts, and reports.

`mail.send` sends through the DAG-level `smtp` block, or through a [mail account](/step-types/mailbox#mail-accounts) named with `mailbox`, which can also reply to email it received. See [Send Through a Mail Account](#send-through-a-mail-account).

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

Configure SMTP at the DAG level for all mail steps. For global configuration, see [Email Notifications](/writing-workflows/email-notifications#smtp-configuration).

### Password Authentication

Use password authentication only when the SMTP provider still accepts it.

```yaml
# Gmail
smtp:
  host: "smtp.gmail.com"
  port: "587"
  username: "your-email@gmail.com"
  password: "app-specific-password"  # Not regular password

# AWS SES
smtp:
  host: "email-smtp.us-east-1.amazonaws.com"
  port: "587"
  username: "${env.AWS_SES_SMTP_USER}"
  password: "${env.AWS_SES_SMTP_PASSWORD}"
```

### OAuth 2.0

OAuth uses the same DAG-level `smtp` block and therefore works for every
`mail.send` step and mail notification in the DAG. Omit `host`, `port`, and
`password`; Dagu selects the provider's STARTTLS endpoint and authenticates with
XOAUTH2.

```yaml
env:
  - SMTP_TENANT_ID: ${SMTP_TENANT_ID}
  - SMTP_CLIENT_ID: ${SMTP_CLIENT_ID}
  - SMTP_CLIENT_SECRET: ${SMTP_CLIENT_SECRET}

smtp:
  username: alerts@contoso.com
  oauth:
    provider: microsoft
    tenant_id: "${env.SMTP_TENANT_ID}"
    client_id: "${env.SMTP_CLIENT_ID}"
    client_secret: "${env.SMTP_CLIENT_SECRET}"
```

Supported `smtp.oauth` provider values are `microsoft`, `google_service_account`,
and `google_refresh`. A mail account takes `google_refresh` or
`microsoft_refresh` instead; see [Mailbox](/step-types/mailbox#oauth). See [Email Notifications](/writing-workflows/email-notifications#smtp-providers)
for the required fields, Google examples, provider authorization steps, and
SMTP inheritance behavior.

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

## Send Through a Mail Account

With `with.mailbox`, `mail.send` uses that account's SMTP server and sign-in from [`mail_accounts`](/step-types/mailbox#mail-accounts) instead of the `smtp` block, and `from` defaults to the account's address. `with.in_reply_to` makes the message a threaded reply to an email the account received; see [Send and Reply](/step-types/mailbox#send-and-reply).

```yaml
secrets:
  - name: REPORTS_MAIL_PASSWORD
    ref: mail/reports

mail_accounts:
  reports@example.com:
    provider: google
    password: ${REPORTS_MAIL_PASSWORD}

steps:
  - id: send_report
    action: mail.send
    with:
      mailbox: reports@example.com
      to: team@example.com
      subject: Weekly Report
      message: The weekly report is attached.
      attachments:
        - report.pdf
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
        - Attempt started: ${context.attempt.started_at}
```

### Success/Failure Notifications

```yaml
handler_on:
  success:
    action: mail.send
    with:
      to: team@company.com
      from: dagu@company.com
      subject: "Pipeline Success - ${context.dag.name}"
      message: |
        Pipeline completed successfully.
        Run ID: ${context.run.id}
        Logs: ${context.paths.log_file}

  failure:
    action: mail.send
    with:
      to: oncall@company.com
      from: alerts@company.com
      subject: "Pipeline Failed - ${context.dag.name}"
      message: |
        Pipeline failed.
        Run ID: ${context.run.id}
        Check logs: ${context.paths.log_file}

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
