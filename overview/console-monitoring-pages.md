---
description: What each Dagu Console monitoring page shows, from the fleet overview and server tabs to run lists, alerts, Insights trends, and each workflow's charts.
---

# Monitoring Console Pages

The **Monitoring** group in [Dagu Console](https://console.dagu.sh)'s sidebar holds these pages. Every member of the workspace can view them. Any member can acknowledge an alert. Only workspace owners can delete reports, disconnect servers, mute workflows, and change who gets alert emails and where alerts go. See [Monitoring](/overview/console-monitoring) to connect a server.

## Overview

- **Failed today (UTC)**, **Open alerts**, **In progress**, and **Success (7 UTC days)** with each day's runs.
- **Needs attention**: problems to act on, each naming the servers it affects: Not reporting, Not checking in, Offline, Scheduler stopped, Failing workflows, Events lost, Monitoring off, and, for owners, Over capacity. Then the open alerts, the runs of Dagu servers waiting for a person, and today's failures, up to 10 of each, each with its failed steps, the last line of its error when the server [sends errors](/overview/console-monitoring#error-messages), and **Open in Dagu** when the server has a [Dagu URL](#dagu-url). Failures include aborted and rejected runs. With none of these, it shows **All clear**.
- **In progress**: the runs queued, running, or waiting, latest first; a run waiting for someone stands out.
- **Instances**: Dagu servers, then Kitewell computers, each by name, those with a problem first.

When failures listed here say nothing of why, owners see a note above them: some servers [send no errors](/overview/console-monitoring#error-messages), with a link to the first one's license page in Dagu, or the workspace keeps no errors of Kitewell computers, with a link to **Settings**.

Times show in your browser's time zone; day totals are by UTC day. On a Team or Pro plan, the Overview, Runs, Alerts, and server pages update themselves every 30 seconds while they are open.

## Instances

**Dagu servers** lists each server with its status, Dagu version, last report, failures today (UTC), success rate over 7 UTC days, and open alerts. When Kitewell computers reported in the last 14 days, **Kitewell computers** lists them after the servers.

| Status | Meaning |
| --- | --- |
| **Reporting** | A report arrived in the last 5 minutes. |
| **Not reporting** | The server reported before, but not in the last 5 minutes. |
| **Not checking in** | The server has not checked in with its license for more than 26 hours. |
| **Offline** | The server has not checked in with its license for more than 72 hours. |
| **Monitoring off** | The server reported that monitoring was turned off, or Dagu Console holds no report from it: monitoring was never turned on, or its reports were deleted. |

**Scheduler stopped** appears next to the status when the last report counts no running scheduler, so scheduled workflows do not start.

Each server's page has these tabs:

- **Overview**: the server's details, such as its ID, Dagu version, OS and architecture, process start, last report, whether [stopped-reporting alerts](/overview/console-monitoring-alerts#stopped-reporting-alerts) are on, and last check-in; the services from the last report; open alerts; and failures as far back as runs show: 30 days on Team or Pro, 14 on a trial, or 7 on [free monitoring](/overview/console-monitoring#free-and-paid).
- **Runs**: the server's runs.
- **Workflows**: each workflow's finished runs per UTC day over the last 14 days as bars, with runs, failures, success rate, and average and longest duration. **Failing** marks a workflow with an open alert, and **Muted** a [muted](/overview/console-monitoring-alerts#mute-a-workflow) one.
- **Settings**, for owners: **Name**, [Dagu URL](#dagu-url), [Alert rules](/overview/console-monitoring-alerts#alert-rules), **Delete reports**, and **Disconnect server**.

### Dagu URL

The address this server's Dagu opens at in your browser, such as `https://dagu.example.com`. With it, failed runs, alerts, and alert emails link to the run in Dagu, at the step that failed, with **Open in Dagu**. Dagu Console never calls it; only your browser opens it.

## Runs

Runs in progress come first, then finished runs, newest recorded first. Filter by:

- **Server**
- **Workflow**
- **Status**: Failed (including aborted and rejected), Succeeded (including partially succeeded), Running, Waiting, or Queued
- Range: **Last hour**, **Last 24 hours** (default), **Last 7 days**, **Last 14 days**, or, on Team or Pro, **Last 30 days**, by when Dagu Console recorded the run. Free monitoring shows up to **Last 7 days**.

Each run has a permalink to a page with its status, start, duration, failed steps, and attempts. When the server [sends errors](/overview/console-monitoring#error-messages), the page shows **Why it failed**: each failed step's error in full, with **Copy**. Without them, it says how to have the server send them. A run in progress on a server that has not reported for 5 minutes shows **Unknown**. A workflow's name opens [its page](#workflow-pages).

With the server's [remote access](/overview/cloud-remote-access#act-on-runs-from-dagu-console) on, the page also reads a failed step's log, retries or stops the run, and approves or rejects a step waiting for a person, as the member's server role allows.

## Alerts

![Open alerts: a server that stopped reporting, a muted workflow's failure, and a failing workflow with when each was emailed](/monitoring/alerts-light.png)

**Open** and **Resolved** alerts, filtered by server. Selecting one opens its page, with why it failed, its timeline, and **Acknowledge**; see [Acknowledge an Alert](/overview/console-monitoring-alerts#acknowledge-an-alert). A workflow's alert shows the workflow, the server, when it opened, the last failure, the number of failures, the last run, and the failed steps. A [run running too long](/overview/console-monitoring-alerts#running-too-long-alerts) shows the limit it passed, the workflow's usual time, and the run. A server's [stopped-reporting alert](/overview/console-monitoring-alerts#stopped-reporting-alerts) shows how long the server has been silent, or was, and its [scheduler alert](/overview/console-monitoring-alerts#scheduler-alerts) since when its scheduler is down and why. Once either resolves, it names the workflows that did not run on schedule meanwhile.

**Notified** shows when the alert was told of, or [why it was not](/overview/console-monitoring-alerts#notified-column), and how its posts to each destination went.

Owners see **Alert emails**, which opens the [recipients](/overview/console-monitoring-alerts#who-gets-alert-emails).

## Notifications

For owners. Lists where the workspace's alerts go: the alert emails, and each [chat channel, PagerDuty service, and webhook](/overview/console-monitoring-alerts#chat-pagerduty-and-webhooks) with the products it gets, its status, and **Send test**. Selecting one opens its delivery log. **Add a destination** opens each kind's setup. Destinations are part of paid plans.

## Insights

![Insights over the last 30 days: runs, failures, and success rate against the previous period, runs per day, success rate, and each workflow with its p95 duration and change](/monitoring/insights-light.png)

**Insights** shows how the workspace's workflows went over the last **7**, **30**, or **90** UTC days, today's runs so far included, against as many days before. Free monitoring offers 7 or 30.

- **Runs**, **Failed**, and **Success**, each with its change against the previous period. A change is shown only when both periods have at least 10 runs.
- **Runs per day**, succeeded and failed, and **Success rate**. **Show as table** lists the same numbers.
- **Workflows**: up to 50, each with a bar per day, runs, failed, success, p95 duration, and its change against the previous period. Sort by workflow, runs, failed, success, p95, or p95 change. **Failing** marks a workflow with an open alert, and **Muted** a muted one.

Filter by **Server** and **Workflow**.

## Workflow Pages

![A failing workflow's page: its open alert, details, cards with changes against the previous period, and charts of runs per day, success rate, and p50 and p95 duration](/monitoring/workflow-light.png)

A workflow's name in **Insights**, **Runs**, **Alerts**, or a server's **Workflows** tab opens its page:

- **Details**: the workflow's key, server, last run, open alert, and whether it is muted.
- Over 7, 30, or 90 UTC days: **Runs**, **Failed**, **Success**, and **p95**, with **Runs per day**, **Success rate**, and **Duration** (p50 and p95) charts.
- **Recent runs**: the last 10 finished runs. **View all** lists the rest on **Runs**.
- **Failures by step**: failed, aborted, and rejected runs over the last 30 days on a trial, Team, or Pro, or 7 on free monitoring, by the step they failed at.
- For owners: **Mute** or **Unmute**.

Dagu Console counts each day's run durations in ranges, from under a second to 8 hours or more, rather than keeping every duration. p50 and p95 are estimated from those ranges, so they show as approximate (≈), and they are never longer than the longest run. Days before 2026-10-13 (UTC) may have no estimate.

## Related Pages

- [Monitoring](/overview/console-monitoring)
- [Alerts and Email](/overview/console-monitoring-alerts)
