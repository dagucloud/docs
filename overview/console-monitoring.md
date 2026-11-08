---
description: See every self-hosted Dagu server in one place, get an email when a workflow fails or a server stops reporting, and track trends. Free for one server. Opt-in; full logs stay on the server.
---

# Monitoring

Connect your Dagu servers to [Dagu Console](https://console.dagu.sh) and see all of them in one place:

- **Every server at a glance**: which servers report, what failed today, open alerts, and what needs attention, such as a stopped scheduler or a server that went silent.
- **Alerts by email, chat, PagerDuty, or webhook**: when a workflow fails and when it recovers, when it misses its deadline, and when a server stops reporting or its scheduler stops, with [rules](/overview/console-monitoring-alerts#alert-rules) for each workflow and server, to the members and addresses you choose, and on a paid plan to Slack, Microsoft Teams, Google Chat, and Discord channels, PagerDuty services, and webhooks. Each alert links to its run.
- **Trends**: runs, success rate, and p50 and p95 duration for each workflow over 7, 30, or 90 days.
- **Full logs stay on the server**: reporting is opt-in, outbound HTTPS only, and carries metadata, plus failed steps' [error messages](#error-messages) only at the level that names them. Full logs, outputs, parameters, and secrets are [never sent](#never-sent), and each server shows the exact JSON it last sent.
- **Free for one server**: a workspace without a plan monitors one server at no cost, with the limits in [Free and Paid](#free-and-paid).

![Dagu Console Overview: two of three servers reporting, failures today, open alerts including a server that stopped reporting, and the 7-day success rate](/monitoring/overview-light.png)

Workflows still run only on your servers. Dagu Console never runs them, and a server does not need the console to run them.

```text
Dagu server ── HTTPS, outbound, every 60 s ──▶ Dagu Console ──▶ Overview, Servers, Runs, Alerts, Insights
                 (every 5 min on Free)
(runs workflows)                                            └──▶ alert emails to the workspace's recipients
```

## Requirements

- Dagu v2.19.1 or later; v2.19.2 or later for free monitoring.
- A Dagu Console workspace. Without a plan, it monitors one server for free. On the Team or Pro plan, or in a trial, it monitors as many servers as the plan includes. See [Free and Paid](#free-and-paid) and [License Comparison](/overview/self-host-license).
- The server is connected to Dagu Console with a license that checks in: approved from **Plan & features**, activated with `dagu license activate`, or started with a server key. See [Connect a Server](/overview/self-host-license#connect-a-server). Servers with offline licenses do not report.
- The server can reach `https://console.dagu.sh` over HTTPS.
- For run status, the [event store](/server-admin/reference#event-store) is enabled. It is by default. Runs on temporary workers or under a standalone coordinator are reported only when they write to the server's event store; see [Monitoring Across Topologies](/overview/deployment-models#monitoring-across-topologies).

## Free and Paid

A workspace without a plan or trial monitors one server for free. Free monitoring unlocks no paid Dagu feature: the server stays on Community, so single sign-on, user management, audit logs, incident routing, and more than 2 API keys stay off.

| | Free | Trial, Team, or Pro |
| --- | --- | --- |
| Servers | 1 | As many as the plan includes |
| Dagu version | v2.19.2 or later | v2.19.1 or later |
| Reports | Every 5 minutes; early reports at most once every 30 seconds | Every 60 seconds; early reports within about 5 seconds |
| Stopped-reporting alert | After 25 minutes without a report | After 10 minutes without a report |
| Finished runs stored | 100 per UTC day | 500 per UTC day |
| Run history shown | 7 days | 30 days |
| Insights and workflow pages | 7 or 30 days | 7, 30, or 90 days |
| Alert emails | Owners and admins | Owners, admins, and the members and addresses you add |
| Chat, PagerDuty, and webhook destinations | None | Up to 10 per workspace, each with [the alerts it gets](/overview/console-monitoring-alerts#which-alerts-a-destination-gets) |
| [Alert rules](/overview/console-monitoring-alerts#alert-rules) and deadlines | The defaults | Per workspace, server, and workflow |
| [MCP clients](/mcp/) | Read what the server reports | Also read logs and act on runs |

A trial gives everything a plan's monitoring does for 14 days, with no card. Workspace owners get an email three days before it ends and another when it ended.

Starting a trial or a plan moves the free server onto it. Dagu picks up the new license as soon as you come back to **Plan & features** from Dagu Console, at the server's next report while monitoring is on, or at its next hourly check-in; **Check now** picks it up at any time. When the plan or trial ends, the server returns to free monitoring at its next check-in, provided no other server holds the free slot.

## Get Your First Alert

1. In Dagu, open **Plan & features** as an administrator. On the **Monitor this server for free** card, keep the level marked **(recommended)** and select **Connect for free**. To try the paid features as well, also select **Also try paid features free for 14 days**; the button becomes **Connect and start trial**. A server that already has a license needs no connecting: select **Turn on** in the **Monitoring** section and choose the same level.
2. Dagu Console opens in a new tab. Sign in or sign up, check that the code matches the one Dagu shows, and approve the server: **Connect for free monitoring** in a workspace without a plan, or **Start 14-day trial and connect** when you asked for the trial. The page shows **Online** while Dagu waits, follows the approval to **Your Dagu server is connected**, and Dagu shows the connection within seconds. Reporting starts at once.
3. Select **Send a test alert** on that page, or open **Settings** in Dagu Console. Under **Alert emails**, owners and admins already get alert emails. With a trial or plan, add any other member or address there, and use **Send test** on a row to check that the email arrives.

Dagu waits up to an hour for the approval, so there is time to sign up or choose a plan first. If the request expires or Dagu stops before you approve it, the approval page says that the server stopped waiting; connect again from Dagu.

The server shows **Waiting for first report** on the console's **Instances** page until its first report arrives, a few seconds after the approval, and **Reporting** from then on. From then on, a failed workflow, or a server silent for 10 minutes (25 on free monitoring), emails the recipients. See [Alerts and Email](/overview/console-monitoring-alerts) for who gets what, and [Console Pages](/overview/console-monitoring-pages) for what each page shows.

## Turn It On

Monitoring is off by default. Upgrading or connecting a server sends nothing beyond its license check-in until an administrator of the server chooses what to report: on the **Monitor this server for free** card before connecting, or in the **Monitoring** section at any time.

### From the web UI

1. Open **Plan & features** as an administrator and select **Turn on** in the **Monitoring** section.
2. Choose **Health only**, **Health and run status**, or, on Dagu v2.22 or later, **Health, run status, and error messages**, which is recommended there. The dialog lists exactly what each choice sends and what is never sent.
3. Select **Turn on**.

Dagu also asks on its own. On a server that was connected without choosing a level, such as with a server key, administrators see a **Monitor this server from Dagu Console** notice above other pages until they choose a level or dismiss it.

A server whose administrators chose **Health and run status** in the web UI before Dagu v2.22 offers error messages once, with a **Show why runs fail in Dagu Console** notice. **Send error messages** opens the dialog with **Health, run status, and error messages** selected. Choosing a level, cancelling the dialog, or dismissing the notice ends the offer. A server whose level is set in configuration never shows it.

The choice applies at once, without a restart, and is kept in the data directory (`cloud/report-settings.json` under `paths.data_dir`). Persist that directory in containers, as you do for the [license](/overview/self-host-license#keep-the-server-s-identity).

The **Monitoring** section on **Plan & features** shows:

- **Reports**: the level, with **Change** and **Turn off**.
- **Last report**: when Dagu Console last accepted a report. After 10 minutes without one, it shows **Not reporting since** and the time.
- **View last report**: the exact JSON of the last report, with the heartbeat secret hidden.

### From the command line

`dagu license activate` without a key connects the server from a shell and, on Dagu v2.22 or later, chooses the level as well: pass `--report errors`, `runs`, `health`, or `off`, or answer the question it asks with the same choices as the web UI. The level is saved once the server is approved. A level set in configuration wins over both.

```bash
dagu license activate --report errors
```

### In configuration

For servers managed as code, set the level in the [configuration file](/server-admin/reference#configuration-file):

```yaml
cloud:
  report: runs   # off, health, runs, or errors (v2.22 or later)
```

or with `DAGU_CLOUD_REPORT=runs`.

| `cloud.report` | Shown in the web UI as | Sends |
| --- | --- | --- |
| empty (default) | Off, until an administrator chooses | Nothing beyond the license check-in |
| `off` | Off | Nothing beyond the license check-in |
| `health` | Health only | [Health](#health) |
| `runs` | Health and run status | [Health](#health) and [run status](#run-status) |
| `errors` (v2.22 or later) | Health, run status, and error messages | [Health](#health), [run status](#run-status), and [error messages](#error-messages) |

A configured value, `off` included, wins over the choice in the web UI. The **Monitoring** section shows **Set in configuration** and offers no **Turn on**, **Change**, or **Turn off**. To change the level, change the configuration and restart Dagu.

## What Is Sent

### Health

Sent at `health`, `runs`, and `errors`:

- Dagu version, operating system, and architecture
- When the server process started
- Which services run: the number of schedulers holding the scheduler lock, and the number of registered coordinators
- The scheduler's last tick, and whether it is paused
- The [remote access](/overview/cloud-remote-access) level, and whether remote approvals are on
- On a paid plan or trial, with Dagu v2.25.4 or later, how busy the server's machine is, from the latest sample Dagu takes every `monitoring.interval` (5 seconds by default): CPU use and the number of CPUs, the 1, 5, and 15 minute load averages, memory use, and the use of the disk that holds the data directory, in percent and bytes. A server on free monitoring sends none of it.
- On a paid plan or trial, with Dagu v2.25.7 or later, how many [distributed workers](/server-admin/distributed/) are live: those whose heartbeat reached a registered coordinator in the last 30 seconds. A server without a coordinator, or on free monitoring, sends no count.

### Run status

Sent at `runs` and `errors`:

- **Each top-level run that finishes**, once: the DAG name, run ID, attempt ID, status (succeeded, partially succeeded, failed, aborted, or rejected), how it was triggered (scheduler, manual, webhook, retry, or catchup), when it was queued, started, and finished, and the names of its failed steps, up to 50.
- **The runs in progress**: the runs queued, running, or waiting, with the same fields up to the start time. A report lists up to 200 of them, the most recently started or queued first, and the total count.
- **Each queue that holds queued or running runs**: its name, how many runs are queued and running, how many may run at once, when the next run in line was queued, and why that run cannot start when no worker can take it. A report lists up to 256 queues, those waiting for a worker first, and the total count. Sent by Dagu v2.25.3 or later.
- **Each distributed worker**, on a paid plan or trial, with Dagu v2.25.7 or later: its ID, host, labels, how many runs it runs of how many it may, its last heartbeat, and how busy its machine is, as for the server's own. A report lists up to 256 of them, by ID, and the count covers them all.
- **Each scheduled DAG**: its name, its next run, and its latest start-schedule slot that came due, with the outcome below. A report lists up to 500 of them, those whose slot failed, is planned, or was missed first, and the total count. When several processes share a data directory, the one that sends runs sends these.

| Slot outcome | Meaning |
| --- | --- |
| `dispatched` | A run was started or enqueued for the slot. |
| `running` | Skipped because a run of the DAG was in progress. |
| `queued` | Skipped because a run of the DAG was queued. |
| `done` | Skipped because a run had already started at or after the slot. |
| `succeeded` | Skipped by [`skip_if_successful`](/writing-workflows/scheduling#skip-redundant-runs) after a successful run. |
| `overlap` | A catchup slot dropped by `overlap_policy`. |
| `failed` | Checking or dispatching the run failed. |
| `planned` | Chosen to run, with its dispatch not yet settled. |
| `missed` | Came due while no scheduler ran, and was not caught up. |

DAG names, queue names, and step names are sent only at `runs` and `errors`. Choose `health` if you consider them sensitive.

### Error messages

Sent at `errors` only, on Dagu v2.22 or later. With them, Dagu Console shows why a run failed on its run page, and alert emails and chat posts quote the end of the error.

- For each finished run that failed, was aborted, or was rejected: the error messages of its failed steps and handlers, in run order, up to 5, or the run's own error when no step has one.
- Each is sent without terminal escapes and cut to its last 2048 bytes. A command step's error ends with the last 1 KiB of its stderr.
- The values of workflow secrets are masked in them, as in logs.

Error messages often contain hosts, paths, or data a step printed, and masking covers only the values of declared secrets. Choose `runs` if you would not send them.

### Never sent

Full logs, outputs, parameters, environment, step commands, DAG YAML, schedule expressions, and the values of workflow secrets are never sent, at any level. Error messages are sent only at `errors`.

Every report also carries what identifies and authenticates the server, as its license check-in does: the protocol version, license ID, server ID, and heartbeat secret. It also carries the level and, at any level but `off`, the time the report was built by the server's clock. At `runs` and `errors`, it also carries the reporter's position in the event store and, after events were lost, the time they were lost from.

[RFC 002: Dagu Cloud Connector](https://github.com/dagucloud/dagu/blob/main/rfcs/002-dagu-cloud-connector.md) specifies the wire contract.

## Cadence and Network

- The server reports every 60 seconds, or every 5 minutes on free monitoring. Dagu Console tells it the interval in each response.
- It reports early, within about 5 seconds, when a run fails, is aborted, or is rejected, and when the runs in progress change: a run is queued, starts, begins waiting, or finishes. On free monitoring, early reports come at most once every 30 seconds; a report sent sooner is refused with a time to retry, and nothing is lost.
- The first report after Dagu starts waits a random 0 to 60 seconds, so servers started together do not report at once.
- Reports are outbound HTTPS requests to `https://console.dagu.sh/api/v1/servers/report`. Nothing connects into the server, and no inbound port is opened.
- The process that holds the license sends the reports: `dagu server` or `dagu start-all`. When several processes share a data directory, each sends its health and one of them sends runs.

If Dagu Console cannot be reached, workflows are not affected. The server keeps its place in the event store, retries with a backoff of up to 5 minutes, and sends the runs it missed once the console is back. Dagu Console stores each finished run once, so a resent report creates no duplicates.

The event store keeps one day of events by default (`event_store.retention_days`). A server cut off for longer loses the runs that finished in between. Its next report says so, and Dagu Console shows **Events lost** for the server instead of guessing those runs.

## Retention and Limits

Dagu Console keeps:

| Data | Kept for |
| --- | --- |
| Finished runs | 30 days, shown for 7 on free monitoring |
| Daily totals per workflow | 13 months |
| Resolved alerts | 90 days after they resolve |
| Open alerts | Until they resolve |
| Health and runs in progress | Until the next report replaces them |

A server that sends no report for 30 days is removed from monitoring, with its daily totals and alerts.

Each workspace stores up to 500 finished runs per UTC day, or 100 on free monitoring, counted by when Dagu Console records them. Past the limit, runs are still counted in the daily totals and still open and resolve alerts, but they are not stored, so they never appear in run lists. Storing resumes at 00:00 UTC. Until then:

- the console's **Overview** shows **Daily run limit reached** with the time;
- workspace owners get one email that day;
- the server's **Monitoring** section on **Plan & features** shows **Run history paused until** 00:00 UTC.

To raise the limit, [contact the Dagu team](https://dagu.sh/contact).

## Turn It Off

- **On the server**: select **Turn off** in the **Monitoring** section of **Plan & features**, or set `cloud.report: off` and restart Dagu. Reporting stops at once, including a report in flight, and a last report tells Dagu Console, which shows **Monitoring off** and opens no [stopped-reporting alert](/overview/console-monitoring-alerts#stopped-reporting-alerts). Turning it on later does not send the runs that finished in between.
- **Delete reports**: turning monitoring off keeps what the server already sent. To remove it, a workspace owner selects **Delete reports** on the server's **Settings** tab. This deletes the server's health reports, run history, and alerts. A server that still has monitoring on reports again, so turn it off on the server first.
- **Disconnect**: disconnecting the server, from **Plan & features** or with **Disconnect server** in Dagu Console, also stops reporting and removes the server from the monitoring pages. See [Check-ins and disconnecting](/overview/self-host-license#check-ins-and-disconnecting).

## Related Pages

- [Alerts and Email](/overview/console-monitoring-alerts)
- [Console Pages](/overview/console-monitoring-pages)
- [Connect a Server](/overview/self-host-license#connect-a-server)
- [Public Webhook URLs](/server-admin/authentication/public-webhook-urls)
- [Remote Access from Dagu Cloud](/overview/cloud-remote-access)
- [Configuration Reference](/server-admin/reference)
- [Notifications](/web-ui/notifications)
- [Incident Routing](/web-ui/incidents)
- [Prometheus Metrics](/server-admin/prometheus-metrics)
