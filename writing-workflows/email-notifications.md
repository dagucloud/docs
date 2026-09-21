# Email Notifications

Dagu provides built-in email notifications for workflow events and errors.

::: tip Web UI notification routing
For team-wide Microsoft Teams, Slack, email, Telegram, and webhook routing from the Web UI, use [Notifications](/web-ui/notifications).

For PagerDuty or SolarWinds incidents that open on final failure and resolve on recovery, use [Incident Routing](/web-ui/incidents). Web UI incident routing requires an active Dagu license or trial on self-hosted deployments.
:::

The YAML fields on this page are useful when you want email behavior to travel with a DAG or base configuration. Web UI notification rules are better when operators should manage channels and event routing without editing DAG YAML.

## SMTP Configuration

Dagu supports password authentication and OAuth 2.0. Both modes use the same
`smtp` block. Dagu uses the selected transport for workflow notifications and
`mail.send` steps.

`password` and `oauth` are mutually exclusive. When `oauth` is configured,
Dagu connects to the provider's SMTP submission endpoint on port `587`, requires
STARTTLS, and authenticates only when the server advertises XOAUTH2. OAuth does
not fall back to password authentication.

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

### OAuth 2.0

Every OAuth configuration requires `smtp.username`. This is the mailbox Dagu
authenticates as and, for Google Workspace service accounts, the user delegated
to the service account.

| Provider | `provider` value | Required OAuth fields |
| --- | --- | --- |
| Microsoft 365 application | `microsoft` | `tenant_id`, `client_id`, `client_secret` |
| Google Workspace service account | `google_service_account` | `service_account_json` |
| Google user refresh token | `google_refresh` | `client_id`, `client_secret`, `refresh_token` |

OAuth provider endpoints are fixed:

| Provider | SMTP endpoint |
| --- | --- |
| Microsoft 365 | `smtp.office365.com:587` |
| Google | `smtp.gmail.com:587` |

Omit `host` and `port` in OAuth configurations. If either field is present, it
must match the endpoint above.

OAuth fields support the same DAG-scoped environment and secret references as
password SMTP fields. Keep client secrets, refresh tokens, and service-account
JSON out of the DAG file; import them through `env:` or a
[secret provider](/writing-workflows/secrets).

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

### OAuth Inheritance

An OAuth-enabled `smtp` block is inherited as one credential boundary. If a
base configuration uses OAuth and a child DAG defines any `smtp` fields, the
child block replaces the complete inherited SMTP configuration. The same rule
applies when a child switches a password-based base configuration to OAuth.

Repeat the complete SMTP identity and credentials in an override. Dagu does not
merge a username from one configuration with OAuth credentials from another.

## Run Snapshots and Retries

SMTP inherited from global or workspace `base.yaml` is omitted from newly
written run snapshots (`dag.json`). Retries, restarts, and queued runs use the
current base SMTP configuration and apply any SMTP overrides from the original
DAG YAML. This applies to local and distributed execution. Workers receive the
effective base configuration with the dispatched task; they do not need a local
`base.yaml` file.

If neither the current base configuration nor the original DAG provides SMTP,
notification emails are not sent. Removing base SMTP therefore does not prevent
a retry from running. A `mail.send` step still reports an error if it cannot
deliver its message.

Other captured base settings, including `env`, notification recipients, and
`mail_on`, remain unchanged. Updating SMTP does not reload saved environment
values. See [Saved Runs](/server-admin/base-config#saved-runs) for runs without
captured base configuration.

::: warning Credential storage scope
The original DAG YAML remains in the snapshot, including any SMTP credentials
written directly in it. Values stored in `env`, distributed task payloads, and
workspace bundles can also retain credentials. Existing history files and
backups are not rewritten.
:::

Upgrade the CLI, API server, and scheduler together so that all processes reading
run snapshots can reload base SMTP.

## Email Triggers

### Success/Failure/Wait Emails

```yaml
mail_on:
  success: true    # Email on successful completion
  failure: true    # Email on failure
  wait: true       # Email when waiting for human input
```

### Step-Level Errors

```yaml
steps:
  - id: critical_step
    run: process_critical_data.sh
    mail_on_error: true  # Email if this step fails
```

### Wait Status Notifications

Send notifications when a DAG is waiting for [human-task completion](/writing-workflows/human-tasks) or an [approval decision](/writing-workflows/approval):

```yaml
mail_on:
  wait: true

wait_mail:
  from: dagu@company.com
  to:
    - approvers@company.com
  prefix: "[ACTION REQUIRED]"
  attach_logs: false
```

This is useful for workflows that require human input before continuing execution. The email includes details about the DAG and which steps are waiting.

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
        Attempt started: ${context.attempt.started_at}

        Report available at: ${steps.generate_report.outputs.report_path}
      attachments:
        - ${steps.generate_report.outputs.report_path}
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
        - Attempt started: ${context.attempt.started_at}
        - Log: ${context.paths.log_file}

        Full log attached.
      attachments:
        - ${context.paths.log_file}
```

## SMTP Providers

### Microsoft 365 Application

This mode uses the OAuth client-credentials grant for unattended delivery.

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

Before using this configuration:

1. Register an application in Microsoft Entra ID.
2. Grant the Office 365 Exchange Online `SMTP.SendAsApp` application permission
   and admin consent.
3. Register the application's service principal in Exchange Online and grant
   it access to the sender mailbox.
4. Ensure SMTP AUTH is enabled for the organization and mailbox.

See Microsoft's
[SMTP OAuth application-authentication guide](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth#authenticate-connection-requests)
and [SMTP AUTH settings](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission).

### Choosing Gmail Authentication

OAuth is optional for Gmail. Dagu's password authentication accepts a Google
app password, which is the simplest setup for personal Gmail and a single
manually managed mailbox. The Google OAuth modes are intended for centrally
managed Workspace automation or an existing OAuth integration.

| Gmail setup | Authentication to choose |
| --- | --- |
| Personal Gmail or one manually managed mailbox | Gmail app password |
| Centrally managed Google Workspace automation | Google Workspace service account |
| Existing OAuth client and refresh token, or a policy that prohibits app passwords | Google refresh token |

### Gmail App Password

Enable 2-Step Verification for the Google account, then create a
[Google app password](https://myaccount.google.com/apppasswords). Store the
16-character app password in an environment variable or secret provider. Do
not use the account's normal password.

```yaml
env:
  - GMAIL_APP_PASSWORD: ${GMAIL_APP_PASSWORD}

smtp:
  host: smtp.gmail.com
  port: "587"
  username: your-email@gmail.com
  password: "${env.GMAIL_APP_PASSWORD}"
```

App passwords may be unavailable for some work or school accounts, accounts
whose 2-Step Verification uses only security keys, and accounts enrolled in
Advanced Protection. See [Google's app-password documentation](https://support.google.com/accounts/answer/185833).

### Google Workspace Service Account

This mode impersonates the mailbox in `smtp.username` through domain-wide
delegation. It is for Google Workspace domains, not consumer Gmail accounts.

```yaml
env:
  - GMAIL_SERVICE_ACCOUNT_JSON: ${GMAIL_SERVICE_ACCOUNT_JSON}

smtp:
  username: alerts@example.com
  oauth:
    provider: google_service_account
    service_account_json: "${env.GMAIL_SERVICE_ACCOUNT_JSON}"
```

Enable domain-wide delegation for the service account, then authorize its
numeric client ID in the Google Admin console with the
`https://mail.google.com/` scope. The delegated user must be a mailbox in the
Workspace domain.

See Google's [service-account delegation guide](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)
and [Gmail XOAUTH2 guide](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol).

### Google Refresh Token

Use this mode when an OAuth client already has a refresh token for the mailbox.
Dagu refreshes access tokens but does not run the interactive authorization
flow that creates the refresh token.

```yaml
env:
  - GMAIL_CLIENT_ID: ${GMAIL_CLIENT_ID}
  - GMAIL_CLIENT_SECRET: ${GMAIL_CLIENT_SECRET}
  - GMAIL_REFRESH_TOKEN: ${GMAIL_REFRESH_TOKEN}

smtp:
  username: alerts@gmail.com
  oauth:
    provider: google_refresh
    client_id: "${env.GMAIL_CLIENT_ID}"
    client_secret: "${env.GMAIL_CLIENT_SECRET}"
    refresh_token: "${env.GMAIL_REFRESH_TOKEN}"
```

The refresh token must be issued to the same OAuth client with offline access
and the `https://mail.google.com/` scope. See Google's
[offline-access guide](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

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
    enum: [development, production]
  - name: alert_recipient
    eval: |
      $(if [ "${params.environment}" = "production" ]; then
        printf '%s' "prod-alerts@example.com"
      else
        printf '%s' "dev-alerts@example.com"
      fi)

steps:
  - id: notify
    action: mail.send
    with:
      to: ${params.alert_recipient}
      subject: "Alert from ${params.environment}"
      message: "Environment-specific alert"
```

Command substitution runs in `params[].eval`, not in mail fields. The enum on
`environment` also constrains the value inserted into the shell expression.

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
```

`mail.send` always sends the message body as `text/html`, so the content type
does not need to be declared. Adding `attachments` switches the message to
`multipart/mixed` automatically.
