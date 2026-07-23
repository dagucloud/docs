# Notifications

Notifications route DAG-run events to team destinations without hard-coding Slack webhooks, email recipients, Telegram chats, or webhook endpoints in every DAG file.

Use notifications for ordinary message delivery: Slack, Google Chat, email, Telegram, or custom webhooks. Use [Incident Routing](/web-ui/incidents) only for systems that manage an incident lifecycle, such as PagerDuty or SolarWinds Incident Response.

![Notification rules in light mode](/notification-rules-light.png)

## Mental Model

Notifications have two parts:

- **Channels** are reusable destinations, such as Slack, email, Telegram, or a generic webhook.
- **Rules** decide which DAG-run events are sent to which channels.

Rules can be configured at three levels:

| Level | What It Means |
| --- | --- |
| **Global** | Default notification rules for every DAG. |
| **Workspace** | Optional override for DAGs in one workspace. |
| **DAG** | Optional override for one DAG. |

Dagu uses the most specific configured scope:

```text
DAG override -> workspace override -> Global default
```

If a scope is set to inherit, Dagu keeps looking at the next broader scope. If a scope is configured, that scope is authoritative. A configured scope with no routes intentionally sends no notifications.

## Events

The Web UI lets you route these DAG-run events:

| Event | Typical Use |
| --- | --- |
| **Failed** | Page the team when a run finishes in failure. |
| **Aborted** | Notify operators when a run is stopped. |
| **Rejected** | Surface queue, concurrency, or policy rejections. |
| **Waiting** | Ask for approval or manual intervention. |
| **Succeeded** | Notify only when successful completion matters. |

New rules default to the operational events: **Failed**, **Aborted**, **Rejected**, and **Waiting**. **Succeeded** is opt-in to avoid noisy channels.

When a DAG has DAG-level auto retry remaining, Dagu does not send the **Failed** notification for the intermediate failed attempt. The failure notification is sent only after the retry budget is exhausted and the DAG run is finally failed.

## Channels

Open **Notifications > Channels** to create destinations before adding rules.

| Channel Type | Use It For |
| --- | --- |
| **Slack** | Send messages through a Slack incoming webhook. |
| **Email** | Send to one or more recipients through the configured SMTP transport. |
| **Generic Webhook** | POST a structured payload to an incident system, chat relay, or internal service. |
| **Telegram** | Send messages through a Telegram bot token and chat ID, optionally targeting a forum topic. |

For Google Chat or another chat service without a dedicated channel type, use a generic webhook when the receiver can accept Dagu's JSON payload, or point the generic webhook at a small relay that converts the payload into that service's expected format.

Channel secrets such as webhook URLs, HMAC secrets, SMTP passwords, and bot tokens are stored encrypted. The UI shows redacted previews after save.

### Telegram Forum Topics

To send notifications to a specific topic in a Telegram forum group, set the optional **Topic ID** on the Telegram channel. Dagu sends this value as Telegram's `message_thread_id`.

The topic ID must be a positive integer. Leave it blank for regular chats or to keep the existing Telegram delivery behavior. To find the ID, inspect a Bot API update for a message posted in the topic and use the message's [`message_thread_id`](https://core.telegram.org/bots/api#message).

After saving the channel, use the **Test** action to confirm that the bot can post to the selected chat and topic.

### Email Delivery

Email has two layers:

- **Email Delivery** configures the SMTP transport: host, port, username, password, and default sender.
- **Email channels** configure recipients, subject/body templates, and whether to attach logs.

Configure SMTP once on the Channels page, then reuse email channels from Global, workspace, or DAG rules.

## Rules

Open **Notifications > Rules** to connect events to channels.

### Global Rules

Use Global rules for organization-wide defaults such as:

- failed production workflows go to `#platform-alerts`
- waiting workflows notify approvers
- rejected runs send to an operations webhook

Every DAG inherits Global rules unless a workspace or DAG override is configured.

### Workspace Rules

Select a named workspace in the Web UI, then open **Notifications > Rules**.

Workspace rules can either:

- **Inherit Global**: use the Global rules as-is.
- **Configure Workspace**: replace Global rules for DAGs in that workspace.

Use workspace overrides when teams have separate channels, such as `data`, `ops`, or `production`.

### DAG Overrides

Open a DAG, then use the **Notifications** tab for per-DAG exceptions.

Keep DAG notifications inherited for most workflows. Configure a DAG override only when one workflow needs a different destination or event set from its workspace.

## Message Templates

Each channel can customize the message text. Templates use simple <code v-pre>{{token}}</code> replacement.

Common tokens:

| Token | Value |
| --- | --- |
| <code v-pre>{{dag.name}}</code> or <code v-pre>{{dagName}}</code> | DAG name |
| <code v-pre>{{run.id}}</code> or <code v-pre>{{dagRunId}}</code> | DAG run ID |
| <code v-pre>{{run.status}}</code> or <code v-pre>{{status}}</code> | Run status |
| <code v-pre>{{run.error}}</code> or <code v-pre>{{error}}</code> | Error message, when present |
| <code v-pre>{{run.path}}</code> or <code v-pre>{{runPath}}</code> | Relative Web UI path for the DAG run |
| <code v-pre>{{run.url}}</code> or <code v-pre>{{runUrl}}</code> | Absolute Web UI URL for the DAG run, when `public_url` is configured |
| <code v-pre>{{run.link}}</code> or <code v-pre>{{runLink}}</code> | `Run: ...` line when an absolute run URL is available |
| <code v-pre>{{run.startedAt}}</code> | Run start time |
| <code v-pre>{{run.finishedAt}}</code> | Run finish time |
| <code v-pre>{{run.attemptId}}</code> or <code v-pre>{{attemptId}}</code> | Attempt ID |
| <code v-pre>{{workspace}}</code> | Workspace name, when present |
| <code v-pre>{{worker.id}}</code> | Worker ID, when present |
| <code v-pre>{{event.type}}</code> or <code v-pre>{{eventType}}</code> | Notification event type |
| <code v-pre>{{event.observedAt}}</code> | Time the event was observed |

Example Slack or Telegram message:

```text
DAG {{dag.name}} {{run.status}}
Run: {{run.id}}
Workspace: {{workspace}}
Error: {{run.error}}
{{run.link}}
```

Email channels also support separate subject and body templates.

## DAG Run Links

Default notification messages include a DAG-run link when Dagu can build an externally reachable Web UI URL.

Set `public_url` in `config.yaml` to the absolute Web UI URL users should open from chat or email:

```yaml
public_url: "https://dagu.example.com"
```

You can also set it with `DAGU_PUBLIC_URL`. For Helm installs, use `config.publicUrl`:

```yaml
config:
  publicUrl: "https://dagu.example.com"
```

If Dagu runs behind a reverse-proxy subpath, include that subpath in `public_url`:

```yaml
public_url: "https://dagu.example.com/workflows"
```

When `public_url` is not configured, <code v-pre>{{run.url}}</code> and <code v-pre>{{run.link}}</code> are empty. <code v-pre>{{run.path}}</code> is still available for systems that know the Dagu base URL.

## Generic Webhook Payload

Generic webhook channels send JSON. If a message template is configured, Dagu includes the rendered message alongside the structured event data.

```json
{
  "version": "v1",
  "message": "DAG daily-report failed: exit status 1\nRun: https://dagu.example.com/dag-runs/daily-report/019e3...",
  "events": [
    {
      "eventType": "dag.run.failed",
      "dagName": "daily-report",
      "dagRunId": "019e3...",
      "runPath": "/dag-runs/daily-report/019e3...",
      "runUrl": "https://dagu.example.com/dag-runs/daily-report/019e3...",
      "status": "failed",
      "error": "exit status 1",
      "observedAt": "2026-05-17T10:00:00Z"
    }
  ]
}
```

Use HMAC signing when the receiving service needs to verify that Dagu sent the webhook.

## Delivery Behavior

Notifications are sent by the Dagu server-side event monitor, not by a workflow step. This means notification delivery works for local runs and distributed workers, including shared-nothing workers, as long as the server receives DAG-run events.

The monitor remembers delivered events so a server restart does not replay old notifications. Use the channel **Test** action when validating credentials and destination access.

## Permissions

Users need developer, manager, or admin permission to manage notification channels and rules.

## Related

- [Workspaces](/web-ui/workspaces)
- [Incident Routing](/web-ui/incidents)
- [Email Notifications](/writing-workflows/email-notifications)
- [Lifecycle Handlers](/writing-workflows/lifecycle-handlers)
- [User Management](/server-admin/authentication/user-management)
