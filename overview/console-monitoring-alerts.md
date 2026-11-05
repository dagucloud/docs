---
description: When Dagu Console opens and resolves monitoring alerts, who gets the emails, how to send alerts to chat, PagerDuty, and webhooks, and how to acknowledge, snooze, or mute them.
---

# Monitoring Alerts and Email

Dagu Console opens an alert when a workflow fails or a server stops reporting, and, on a paid plan, when a server's [scheduler stops](#scheduler-alerts), a server's [disk is almost full](#disk-almost-full-alerts), its [memory](#memory-high-alerts) or [CPU](#cpu-high-alerts) use stays high, one of its [queues stalls](#queue-stalled-alerts), a workflow [misses its deadline](#deadline-alerts), a scheduled run [does not start](#missed-schedule-alerts), or a run runs [much longer than usual](#running-too-long-alerts). It emails the workspace's alert recipients when it opens and when it resolves. On a paid plan, it also sends the alert to the workspace's [chat channels, PagerDuty services, and webhooks](#chat-pagerduty-and-webhooks). See [Monitoring](/overview/console-monitoring) to connect a server, and [Alerts](/overview/console-monitoring-pages#alerts) for the page that lists them.

## Workflow Alerts

Workflow alerts need the `runs` level. An alert belongs to one workflow on one server.

- A run with status failed opens an alert, or, when the workflow's [alert rules](#alert-rules) ask for several failures in a row, the last of them does. The alert opens as of the first of them and counts them all. Further failures add to its count.
- A later run that succeeds or partially succeeds resolves it, or any member [resolves it by hand](#resolve-an-alert-by-hand).
- Aborted and rejected runs count as failures in totals, but they neither open nor resolve an alert.

## Stopped-Reporting Alerts

Stopped-reporting alerts need `health` or `runs`.

A server that sends no report for 10 minutes, or 25 minutes on [free monitoring](/overview/console-monitoring#free-and-paid), opens an alert, and its [recipients](#who-gets-alert-emails) are emailed. A server's [alert rules](#alert-rules) can wait longer, up to 24 hours. Its next report resolves the alert, and that email says how long the server was silent.

- Every server that has reported is watched. To stop watching one, a workspace owner opens its **Settings** tab, sets **Stopped reporting** to **Off** under **Alert rules**, and selects **Save changes**. This choice is on every plan, free monitoring included. Turning it off closes an open alert without an email.
- A server whose monitoring is turned off opens no alert. Turning monitoring off sends one last report that says so: the server shows **Monitoring off**, and an open stopped-reporting alert closes without an email.
- When many servers stop reporting at the same moment, Dagu Console takes the problem to be on its own side and opens no alerts for them.

## Scheduler Alerts

On a Team or Pro plan, a server whose scheduler is down for 5 minutes opens an alert, since no scheduled workflow starts while it lasts. These alerts need `health` or `runs`.

- The scheduler counts as down when the server's report counts no running scheduler, or when one runs but has not ticked for 5 minutes and nobody paused it. A paused scheduler opens no alert.
- Only a server that has reported a running scheduler before is watched, so a server that never runs one, such as one whose runs start on [temporary workers](/overview/deployment-models#temporary-workers), opens none.
- It resolves when a scheduler runs again. The email or post that says so names the workflows that did not run on schedule meanwhile.
- To stop them for one server, a workspace owner clears **Alert when its scheduler stops** in the server's [alert rules](#alert-rules). Turning it off closes an open one without an email.

## Disk Almost Full Alerts

On a Team or Pro plan, a server whose disk is 90% full or more, or the percent its [alert rules](#alert-rules) set, from 50 to 99, opens an alert. These alerts need Dagu v2.25.4 or later, which sends the machine's figures with each report, at `health` or `runs`.

- The disk is the one that holds the server's data directory, where runs, logs, and queues stop when it fills up. A Dagu release after v2.25.4 also sends the disk that holds the log directory, when that is another disk, and how many of each disk's inodes are in use. The fullest of these counts: a disk whose inodes run out can make no new file even with bytes to spare.
- The email or post says which disk filled up, and how full it is, by bytes or by inodes.
- It resolves once that disk is 5 points under the percent, 85% by default, so a disk near the line alerts once rather than again and again.
- Turning **Disk almost full** off in the [alert rules](#alert-rules) closes an open one without an email.
- A report without the disk's figures, as from an earlier Dagu or after the workspace stops paying, closes an open one without an email.

## Memory High Alerts

On a Team or Pro plan, a server whose memory use stays at or over 90% for 10 minutes, or the percent and minutes its [alert rules](#alert-rules) set, opens an alert. These alerts need Dagu v2.25.4 or later, at `health` or `runs`.

- The alert opens as of when the use went over the percent. A single report over it opens nothing.
- Use that drops under the percent starts the wait over.
- It resolves once use is 5 points under the percent, and the email or post says how much is in use then.
- In a container with a memory limit, a Dagu release after v2.25.4 measures the container's memory against that limit rather than the host's.
- Turning **Memory high** off, or a report without memory use, closes an open one without an email.

## CPU High Alerts

On a Team or Pro plan, workspace owners can turn on alerts of a server whose CPU use stays high. They are off by default. Once on, a server whose CPU use stays at or over 90% for 15 minutes, or the percent and minutes the [alert rules](#alert-rules) set, opens an alert, as for [memory](#memory-high-alerts).

- CPU use is the average over the samples since the server's last report, from a Dagu release after v2.25.4, and the latest sample from earlier releases. In a container with a CPU limit, it is measured against that limit.
- It resolves once use is 5 points under the percent.

## Alerts of Workers' Machines

With a Dagu release after v2.25.4 at `runs`, the [disk](#disk-almost-full-alerts), [memory](#memory-high-alerts), and [CPU](#cpu-high-alerts) alerts also watch each machine a server's [distributed workers](/server-admin/distributed/) run on, with the server's [alert rules](#alert-rules).

- An alert names the machine after its server, such as `etl-prod-1 (gpu-1)`. Workers on one machine share its alerts.
- A worker's CPU use is its average over the last minute.
- When a report lists every worker and none runs on a machine any more, the machine's alerts resolve, and the email or post says it is no longer reported.
- A report that does not list the workers, as at `health`, closes them without an email.
- A worker on the server's own machine is watched twice: once as the server, and once by its host name.

## Queue Stalled Alerts

On a Team or Pro plan, a server's [queue](/server-admin/queues) opens an alert once its next run has waited 10 minutes, or the minutes the [alert rules](#alert-rules) set, while the queue has room to run it or no worker takes it. These alerts need Dagu v2.25.3 or later at `runs`.

- A queue whose runs fill it is not stalled: its next run waits its turn.
- A run that waits for a [worker](/server-admin/distributed/) says why: no worker matches its selector, every worker that matches is busy or unhealthy, or runs cannot be sent to workers.
- A server has one such alert per queue, as of when the queue's next run was queued. The email or post says how many runs the queue held and why its next run waits.
- It resolves once the queue no longer stalls: its next run starts, its runs fill it, or it holds no more runs.
- A server whose monitoring is turned off, or set to `health`, or a report that cannot list the queues, closes these alerts without an email. So does turning **Queue stalled** off.

## Too Few Workers Alerts

On a Team or Pro plan, a server opens an alert once fewer of its [distributed workers](/server-admin/distributed/) are live than its [alert rules](#alert-rules) want, for as long as they set: by default, none live for 5 minutes, so runs that need a worker wait. These alerts need a Dagu release after v2.25.4, at `health` or `runs`.

- A worker is live while its heartbeat reaches the server's coordinator, at most 30 seconds old. A server whose report counts no coordinator has no live worker, since none can take its runs.
- Only a server that has reported a live worker is watched, so a server that runs a coordinator for no worker, as `dagu start-all` does by default, opens none.
- The alert opens as of when the workers became too few, and resolves once enough are live. The email or post says how many are live and how many the rules want.
- The rule counts workers rather than following each one, since a worker's default ID changes when it restarts.
- A report that cannot count the workers leaves the alert as it is. Turning **Too few workers** off closes an open one without an email.

## Deadline Alerts

On a Team or Pro plan, a workspace owner gives a workflow a deadline in its [alert rules](#alert-rules): a time of day, on chosen days of the week, in the workspace's [time zone](#who-gets-alert-emails). When a deadline comes and no run of the workflow succeeded since the one before, an alert opens, as of the deadline.

- A workflow has one such alert at a time. Each later deadline it misses adds to its count.
- A run that succeeds resolves it, and the email or post says it succeeded after its deadline.
- A new deadline counts the runs that succeeded since its last time, so setting one opens no alert for a workflow that already ran.
- The alert opens even while the server is silent, since the work is late either way.
- A deadline at a time the clocks skip, when daylight saving time starts, moves with the clocks.

## Missed-Schedule Alerts

On a Team or Pro plan, a scheduled run that did not start opens an alert once it is 5 minutes late, or as late as its [alert rules](#alert-rules) allow. These alerts need the `runs` level.

- A workflow has one such alert at a time. Later slots that do not start add to its count. It says when the run was due, why it did not start, and when the next run is.
- It resolves when a later slot's run starts, or when the workflow is no longer scheduled.
- While the server's scheduler alert is open, or as the server reports again after it stopped reporting, these alerts open marked **Held back**: they are not told of on their own, and the server's alert names their workflows when it resolves. One message stands for them all.
- A server whose monitoring is turned off, or set to `health`, closes these alerts without an email.

## Running-Too-Long Alerts

On a Team or Pro plan, a run still running well past its workflow's usual time opens an alert. These alerts need the `runs` level.

- A workflow's limit is twice how long 95% of its runs took over the last 14 UTC days, and at least 10 minutes more. A workflow with fewer than 10 timed runs in that time is measured over the last 90 days instead, so weekly workflows get a limit too. One with fewer than 10 in 90 days has no limit.
- A workflow's [alert rules](#alert-rules) can fix the limit instead, from 1 minute to 7 days, whatever its runs took.
- Only a running run counts. A queued run, or one waiting for approval, does not.
- A workflow has one such alert at a time. It names the oldest run past the limit, how long the workflow's runs usually take, and the limit, or the fixed limit it passed.
- It resolves when the run finishes, or when the server no longer lists the run in progress. A run that finishes as failed also opens the workflow's failure alert.
- A server whose monitoring is turned off, or set to `health`, closes these alerts without an email.

## Alert Rules

On a Team or Pro plan, workspace owners choose when Dagu server workflows, and servers' machines, queues, and workers, alert. Rules apply to new alerts; alerts already open stay until they resolve. Turning a machine, queue, or worker rule off closes its open alerts without an email.

| Rule | Choices | Default |
| --- | --- | --- |
| **Memory high** | On or off, the percent, 50 to 99, and for how many minutes, 1 to 1440 | On, at 90% for 10 minutes |
| **CPU high** | On or off, the percent, 50 to 99, and for how many minutes, 1 to 1440 | Off; at 90% for 15 minutes once on |
| **Disk almost full** | On or off, and the percent, 50 to 99 | On, at 90% |
| **Queue stalled** | On or off, and after how many minutes, 1 to 1440 | On, after 10 minutes |
| **Too few workers** | On or off, the fewest live workers, 1 to 1000, and for how many minutes, 1 to 1440 | On, fewer than 1 for 5 minutes |
| **Failed runs** | On or off, and how many failures in a row, 1 to 20 | On, after 1 |
| **Runs running too long** | The learned limit, a fixed limit of 1 minute to 7 days, or off | The learned limit |
| **Scheduled runs that do not start** | On or off, and how many minutes late, 1 to 720 | On, after 5 minutes |

Rules are set at three levels, each taking what it leaves empty from the one above:

1. **The workspace**: **Alert rules** on the **Notifications** page sets every rule for all servers and their workflows.
2. **A server**: **Alert rules** on its **Settings** tab sets the machine, queue, and worker rules for itself and the rules for its workflows. It also sets **Stopped reporting**, on or off on any plan, and after how many minutes, from 10 to 1440, and **Scheduler stopped**.
3. **A workflow**: **Alert rules** on [its page](/overview/console-monitoring-pages#workflow-pages) sets its own workflow rules, and its [deadline](#deadline-alerts): **Must succeed by** a time, **On** chosen days.

A choice marked **Inherited** shows what the level above sets, and an empty number shows it as a placeholder. Kitewell projects' workflows keep the defaults.

## Who Gets Alert Emails

A workspace owner chooses who is emailed in **Settings** under **Alert emails**. Alert emails come from `no-reply@dagu.sh` when an alert opens and when it resolves. Alerts that open or resolve together arrive in one email.

| Recipient | Added |
| --- | --- |
| **Owners and admins** | Always listed. The workspace's owners and admins, on by default. |
| A member | At once, by entering their address in **Add a recipient**. |
| An outside address | After it is verified. Entering any other address sends it a link to verify it, which works for 7 days and opens a page with **Verify address**. The address is emailed nothing else until then. **Resend link** sends a new link, at most once every 10 minutes. |

- A recipient gets Dagu server alerts while **Dagu servers** is checked on its row. Clear it and select **Save changes** to stop them, for example on **Owners and admins**.
- On [free monitoring](/overview/console-monitoring#free-and-paid), only **Owners and admins** get Dagu server alerts. The **Dagu servers** box on other rows is unavailable and keeps its setting for when the workspace has a trial or plan.
- **Send test** emails the row a test alert. **Remove** takes a member or address off the list.
- Up to 20 members and addresses besides owners and admins, of which up to 5 may wait to be verified. Verification and test emails are capped per workspace each UTC day.
- **Email language** sets the language of alert, test, and verification emails: English (default), Français, 日本語, 简体中文, العربية, or 한국어.
- **Time zone** sets the zone that times in alert emails and chat posts are shown in, such as `2026-10-12 14:41 JST`. Until an owner saves one, times are UTC and the field suggests the browser's zone. Daily run limits and usage still count UTC days.
- An address that the email service refuses is skipped. The other recipients still get the email.

## Weekly Summary

On a Team or Pro plan, each owner gets a summary of the workspace's week every Monday from 8:00 in the workspace's [time zone](#who-gets-alert-emails), covering Monday to Sunday:

- finished runs and their success rate, against the week before;
- alerts opened and resolved, with the median time to acknowledge and to resolve them, and the longest;
- the workflows that failed most, and those whose 95th-percentile duration grew most;
- servers and computers that stopped reporting, and for how long;
- destinations that stopped taking alerts.

A week with no runs and no alerts sends no summary. To stop it for the whole workspace, an owner clears **Weekly summary** under **Alert emails** and selects **Save changes**. **Send me last week's summary** emails it to you at once, at most once a minute. Each summary ends with a link that stops it for its address only; alert emails do not change.

## Unsubscribe

Every alert email ends with a link to unsubscribe, and mail clients that offer one-click unsubscribe can use it too. The link opens a page with **Unsubscribe**. Nothing changes until it is selected.

An address that unsubscribed gets no alert emails from the workspace, even when it is added again. **Alert emails** shows it as **Unsubscribed**. Only the person at that address can subscribe again, with **Subscribe again** on the page the link opens.

## Chat, PagerDuty, and Webhooks

On a Team or Pro plan, a workspace owner adds up to 10 destinations on the **Notifications** page. Each one gets Dagu server alerts, Kitewell alerts, or both. An alert goes to each destination that gets its product when it opens and when it resolves, as for its email. Under **Add a destination**, each kind opens a short setup that says where to find what it needs.

| Destination | What it takes | What it gets |
| --- | --- | --- |
| **Slack** | The Webhook URL of a Slack app's incoming webhook, which starts with `https://hooks.slack.com/services/`. Create an app at [api.slack.com/apps](https://api.slack.com/apps), turn on **Incoming Webhooks**, and select **Add New Webhook** for the channel. | One message per alert. |
| **Microsoft Teams** | The URL of a Teams workflow. In the channel, select **More options** (⋯), then **Workflows**, and add **Post to a channel when a webhook request is received**. Office 365 connector URLs, which Microsoft retired, are refused. | One Adaptive Card per alert. |
| **Google Chat** | The webhook URL of a space, which starts with `https://chat.googleapis.com/v1/spaces/`. In the space, select its name, then **Apps & integrations**, then **Add webhooks**. | One card per alert; its recovery replies in its failure's thread. |
| **Discord** | The webhook URL of a channel, which starts with `https://discord.com/api/webhooks/`. In the channel's settings, select **Integrations**, then **Webhooks**, then **New Webhook**. | One embed per alert, which mentions no one. |
| **PagerDuty** | The **Integration Key** of an **Events API V2** integration on the service, and its service region, US or EU. | An incident when an alert opens, resolved when the alert resolves. |
| **Webhook** | Any `https://` URL on the public internet. The page that adds it shows its signing secret once. | One signed JSON post per alert. |

- A chat post names what failed and where, quotes the end of its error when the server [sends errors](/overview/console-monitoring#error-messages), and has **View run** and, when the server has a [Dagu URL](/overview/console-monitoring-pages#dagu-url), **Open in Dagu**. A pass sends at most 20 alerts to a chat channel or webhook and sums up the rest in one more message.
- A PagerDuty incident's summary names what failed and the last line of its error. Acknowledging the alert acknowledges the incident. Its details carry the host, the workflow, the run, the failed steps, and the error, with links to the run. A workflow's failure, a missed deadline, a scheduled run that did not start, and a stalled queue have severity `error`, a run running too long, a disk almost full, and memory or CPU use that stays high `warning`, and a server that stopped reporting or whose scheduler stopped `critical`. Each alert is its own incident, keyed `dagu:<workspace>:<alert>`, so an event sent twice opens no second incident. Every alert of a pass is sent.

### Which Alerts a Destination Gets

A destination gets every alert of its products until a workspace owner narrows it under **Which alerts** on its page:

- **Kinds of alerts**: failed runs, missed deadlines, runs running too long, scheduled runs that do not start, servers that stopped reporting, stopped schedulers, disks almost full, memory high, CPU high, and stalled queues. Choosing all of them also takes kinds added later.
- **Dagu servers and workflows**: all of them, or only those chosen. A chosen server includes its workflows. Kitewell alerts are not narrowed by this choice.

The **Notifications** page marks a narrowed destination **Some alerts**. A destination whose chosen servers and workflows are all gone gets no Dagu server alerts until it is changed. Email recipients are not affected.

**Send test** sends the workspace's last workflow alert of a product the destination gets, as it looked while failing, or an example when there is none, under a line saying it is a test. It runs at most once a minute.

- Adding a chat channel sends a test at once. Teams answers before it posts the card, so only the channel shows whether it arrived.
- A PagerDuty test opens an incident and resolves it at once, so whoever is on call may be paged. The page asks before it is sent.

The destination's **Status** shows when it last took a post, its last refusal, or how many posts wait to be tried again. Selecting a destination opens its page, which lists its latest 50 posts of alerts as **Sent**, **Retrying**, **Gave up**, **Skipped**, or **In a summary**, with each answer.

- A refused post is tried again after 30 seconds, then after waits that double up to an hour, or after the wait a `Retry-After` header asks for, for up to a day. Each destination is tried on its own, so one that is down holds back no email or other destination.
- An answer of 401, 403, 404, or 410 gives up on the post at once. Three in a row stop the destination: the **Notifications** page says so, and **Turn back on** on its page lets it take alerts again once it is fixed.
- A resolution is posted only after its opening, and only to the destinations its opening went to. An alert that resolves before its opening was posted is posted to neither.

Destination URLs, signing secrets, and integration keys are stored encrypted.

A webhook post carries these headers:

| Header | Value |
| --- | --- |
| `X-Dagu-Event` | `alert.opened`, `alert.reminder`, `alert.resolved`, `alerts.more`, or `test`. A `test` carries a sample alert, as **Send test** describes. |
| `X-Dagu-Delivery` | The ID of the delivery, the same on every retry of it, to drop a post received twice |
| `X-Dagu-Signature` | `t=<unix seconds>,v1=<hex>`: the HMAC-SHA256 of `t`, a `.`, and the body, keyed by the signing secret |

```json
{
  "type": "alert.opened",
  "sent_at": "2026-10-12T05:41:30Z",
  "workspace_id": "<workspace>",
  "alert": {
    "id": 42,
    "rule": "workflow_failed",
    "workflow": "nightly-etl",
    "host": { "kind": "dagu_server", "id": 7, "name": "etl-prod-1" },
    "failures": 1,
    "failed_steps": ["load"],
    "errors": [{ "step": "load", "message": "exit status 1\nrecent stderr (tail):\nconnection refused" }],
    "last_run_id": "0193f1c2a7d84e6b",
    "opened_at": "2026-10-12T05:41:00Z",
    "last_failed_at": "2026-10-12T05:41:00Z",
    "resolved_at": null
  },
  "links": {
    "alerts": "https://console.dagu.sh/alerts?ws=<workspace>",
    "run": "https://console.dagu.sh/runs?run=0193f1c2a7d84e6b&server=7&ws=<workspace>",
    "dagu": "https://dagu.example.com/dag-runs/nightly-etl/0193f1c2a7d84e6b?step=load"
  }
}
```

A stopped-reporting alert has `rule` `runner_offline` and no run. `errors` is present only when the server sends errors.

A [running-too-long alert](#running-too-long-alerts) has `rule` `run_too_long` and a `detail` object: `attempt_id`, `started_at`, `limit_ms`, `typical_ms` (the usual time), and `samples` (the timed runs it was measured over). Once resolved, `detail.resolution` is `finished`, `gone` (no longer listed in progress), or `unreported` (the server stopped telling of runs).

A [disk almost full alert](#disk-almost-full-alerts) has `rule` `disk_almost_full` and a `detail` object, as the fullest disk was when the alert opened, and once resolved, as it was then:

- `disk`: `used_percent`, `used_bytes`, and `total_bytes`, and `inodes_used_percent` when the disk's filesystem says.
- `disk_kind`: `data` for the disk that holds the data directory, or `logs` for the one that holds the log directory.
- `inodes`: `true` when the disk's inodes, rather than its bytes, were the fuller.
- `threshold`: the percent the disk crossed.
- `host`: the machine, as for memory and CPU below.

A [memory high](#memory-high-alerts) or [CPU high](#cpu-high-alerts) alert has `rule` `memory_high` or `cpu_high` and a `detail` object: `percent`, the use when it opened, and once resolved, when it resolved; `threshold`, the percent it crossed; and `since`, when the use went over it. `host` names the machine when it is not the server's own, and is left out for the server's own. An alert of a worker's machine that resolved because no worker on it reports any more has `gone` `true`.

A [too few workers alert](#too-few-workers-alerts) has `rule` `workers_low` and a `detail` object: `workers`, how many were live when it opened, and once resolved, when it resolved; and `minimum`, the fewest its rules wanted.

A [stalled queue alert](#queue-stalled-alerts) has `rule` `queue_stalled` and a `detail` object, as the queue was when the alert opened: `queue`, its name; `queued` and `running`, its runs; `max_active`, how many may run at once; `waiting_since`, when its next run was queued; and `blocked_reason`, `NoMatchingWorker`, `NoAvailableWorker`, or `WorkerDispatchUnavailable`, when that run waits for a worker.

An alert [resolved by hand](#resolve-an-alert-by-hand) has `detail.resolution` `manual` and `detail.resolved_by`, the email of whoever resolved it.

## Acknowledge an Alert

Each alert has a page: select it on the **Alerts** page, or follow **View alert** in a chat post or **Alert:** in an email. It shows what the alert is about, why its workflow failed, and a **Timeline** of when it opened, was emailed, was posted to each destination and how that went, was acknowledged, and resolved.

Any member of the workspace selects **Acknowledge** on an open alert to say they are on it. An alert email's **Acknowledge:** link does the same without signing in, as the address the email went to, for 7 days after the alert opened: opening it shows the alert, and **Acknowledge** on that page acknowledges it. The **Alerts** page then marks it **Acknowledged**, naming who on hover, and a [PagerDuty](#chat-pagerduty-and-webhooks) incident of the alert is acknowledged too. **Take back** undoes it. A resolved alert needs no acknowledgement.

### Resolve an Alert by Hand

An alert about a workflow stays open until the workflow does what resolves it, such as a run that succeeds. When that will not happen, for example because the workflow no longer runs, any member selects **Resolve** on the alert's page.

- The alert is told of as resolved, by email, in chat, and to webhooks, naming who resolved it, and a [PagerDuty](#chat-pagerduty-and-webhooks) incident of the alert is resolved.
- The workflow's next failure, missed deadline, or missed schedule opens a new alert. A run running too long is not alerted of again after its alert is resolved by hand; another run of the workflow is.
- An alert that a server or computer stopped reporting, that a server's scheduler stopped, or about a server's disk, memory, CPU, queue, or workers, has no **Resolve**: it resolves when the server or computer reports again, its scheduler runs, or its figures, queue, or workers are back to normal.

### Reminders

On the **Notifications** page, a workspace owner sets **Reminders** to **Every hour**, **Every 4 hours**, or **Every day**. An open alert no one acknowledged is then posted again to its chat destinations and webhooks at that interval, up to 6 times, saying it is still failing, still without a success, still running long, still not running on schedule, still not reporting, its scheduler is still stopped, its disk is still almost full, its memory or CPU use is still high, its queue is still stalled, or it still has too few workers, with a link to its page. A webhook gets it as an `alert.reminder` event. PagerDuty is not reminded, since it escalates on its own. Reminders are part of paid plans.

Acknowledging an alert stops its reminders. To pause them without acknowledging, any member selects **Snooze reminders** on the alert's page for 1 hour, 4 hours, 1 day, or until 9:00 in the workspace's [time zone](#who-gets-alert-emails); **Resume reminders** ends the snooze early. Reminders and snoozes appear on the alert's **Timeline**. A muted workflow's alerts are not reminded of.

## Mute a Workflow

A workspace owner mutes a noisy workflow from [its page](/overview/console-monitoring-pages#workflow-pages): **Mute**, then **For 1 hour**, **For 1 day**, **For 7 days**, or **Until unmuted**. **Unmute** ends it early.

While a workflow is muted, its alerts still open and resolve, marked **Muted**, but nobody is emailed. Muting covers a workflow's alerts only. A server that stops reporting is still emailed.

## Notified Column

On the **Alerts** page, **Notified** shows when an alert was told of, or why it was not:

| Shown | Meaning |
| --- | --- |
| A time | When the alert was emailed and its posts to [destinations](#chat-pagerduty-and-webhooks) were planned. |
| **Pending** | The email is waiting to go out. |
| **Not sent** | The alert resolved before its email went out. |
| **No recipients** | No [alert recipient](#who-gets-alert-emails) gets Dagu server alerts. |
| **Muted** | The alert opened while its workflow was [muted](#mute-a-workflow). |
| **Held back** | Its server's scheduler or stopped-reporting alert told of it. See [Missed-Schedule Alerts](#missed-schedule-alerts). |

Beside the time, each destination its opening went to shows its mark, with a green dot once it was sent, an amber one while it is tried again, and a red one when it was given up on. A faded mark was skipped or folded into a summary. Hovering a mark names the destination and its status.

## Example Email

Alert emails are plain text. A failure and a recovery that happen together arrive as one email. A failure quotes the last lines of its error when the server sends errors, and **Open in Dagu** appears when the server has a Dagu URL:

```text
Subject: [DaguCloud] nightly-etl failed on etl-prod-1 (1 more alert)

Failed

- nightly-etl on etl-prod-1 at 2026-10-12 05:41 UTC
  Run 0193f1c2a7d84e6b, failed at load
    connection refused
  View run: https://console.dagu.sh/runs?run=0193f1c2a7d84e6b&server=7&ws=<workspace>
  Open in Dagu: https://dagu.example.com/dag-runs/nightly-etl/0193f1c2a7d84e6b?step=load
  Workflow: https://console.dagu.sh/workflows/12?ws=<workspace>
  Alert: https://console.dagu.sh/alerts/42?ws=<workspace>
  Acknowledge: https://console.dagu.sh/alert-emails/acknowledge?a=42&t=<token>&w=<workspace>&x=<expiry>

Reporting again

- backup-01 (Dagu server) reported at 2026-10-12 05:48 UTC, after 12 minutes without a report

Alerts: https://console.dagu.sh/alerts?ws=<workspace>

You get this email as an owner of the workspace Acme Operations on Dagu Console.
Unsubscribe: https://console.dagu.sh/alert-emails/unsubscribe?r=<token>&w=<workspace>
```

## Related Pages

- [Monitoring](/overview/console-monitoring)
- [Console Pages](/overview/console-monitoring-pages)
- [Notifications](/web-ui/notifications)
