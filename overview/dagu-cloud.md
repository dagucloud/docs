---
description: "Dagu Cloud is the control plane for self-hosted Dagu servers: watch, alert on, and act on runs from Dagu Console or MCP clients. Servers connect out; workflows run only on them."
---

# Dagu Cloud

Dagu Cloud is the control plane for your self-hosted Dagu servers. Connect each server once, then watch, alert on, and act on all of them from [Dagu Console](https://console.dagu.sh), or from ChatGPT, Claude, and other MCP clients through one MCP endpoint.

Workflows keep running only on your servers. Each server opens its own connections to Dagu Cloud; nothing connects in, and a server keeps running its workflows when Dagu Cloud is out of reach.

```text
Members ───── Dagu Console ──┐
                             ├──▶ Dagu Cloud ◀── reports, HTTPS outbound ─── Dagu server
MCP clients ───── MCP ───────┘        │     ─── calls, over a connection ──▶ (runs workflows)
                                      │         the server opens
                                      ▼
               email, Slack, Microsoft Teams, Google Chat, Discord, PagerDuty, webhook
```

## What It Does

| | What you get |
| --- | --- |
| **See** | Every server's health, runs, failures, and trends on one set of pages, with each machine's CPU, memory, load, and disk use over the last day, and each server's distributed workers. The Overview lists what needs a person: runs waiting for a decision, open alerts, and today's failures. See [Monitoring](/overview/console-monitoring). |
| **Alert** | One alert per problem: a failed workflow, a missed deadline, a run far past its usual time, a server that stopped reporting, a disk almost full, too few workers. By email, and on a paid plan to chat channels, PagerDuty, or a webhook. See [Alerts and Email](/overview/console-monitoring-alerts). |
| **Act** | Read a failed step's log, retry or stop a run, and approve or reject a step that waits for a person, from Dagu Console. See [Act on Runs from Dagu Console](/overview/cloud-remote-access#act-on-runs-from-dagu-console). |
| **MCP** | One MCP endpoint, `https://console.dagu.sh/mcp`, for every server in a workspace. MCP clients read runs and logs, start and retry workflows, and edit DAGs, as each member's role and each server allow. See [MCP](/mcp/). |
| **Team** | Up to 10 people per workspace, each with their own sign-in, and server roles that bound what each person and the MCP clients they connect may do. See [Dagu Console Members](/overview/console-members). |
| **Licenses** | Each connected server gets its license from Dagu Cloud, which turns on SSO, RBAC, audit logging, and incident routing on the server. See [Self-hosted Plan Comparison](/overview/self-host-license). |

## Connect a Server

1. Connect the server to Dagu Console: approve it from **Plan & features** in Dagu, run `dagu license activate`, or start it with a server key. See [Connect a Server](/overview/self-host-license#connect-a-server).
2. Turn on monitoring so the server reports its health and runs. See [Turn It On](/overview/console-monitoring#turn-it-on).
3. To act on runs from Dagu Console or through MCP, turn on remote access on the server and choose the highest role it allows. See [Turn It On](/overview/cloud-remote-access#turn-it-on).

## What Stays on Your Servers

- Workflows, their commands, and their secrets run only on your servers. Dagu Cloud never runs them.
- Reports carry metadata, and the error messages of failed steps at the level that names them. Full logs, outputs, parameters, and secrets are [never sent](/overview/console-monitoring#never-sent).
- Remote access is off until a server's administrator turns it on, and the server sets the highest role any call gets. Each call is signed for that request alone and recorded in the server's own audit log. See [Security](/overview/security).
- Servers with offline licenses never connect to Dagu Cloud.

## Plans

| | Free | Team | Pro |
| --- | --- | --- | --- |
| Servers | 1, monitoring only | 3 | 15 |
| Alerts | Email to owners and admins | Email, chat, PagerDuty, webhook | Email, chat, PagerDuty, webhook |
| Run history | 7 days | 30 days | 30 days |
| Machine CPU, memory, and disk, with disk alerts | No | Yes | Yes |
| Act on runs | No | Yes | Yes |
| MCP clients | Read what the server reports | Also read logs, act on runs, and edit DAGs | Also read logs, act on runs, and edit DAGs |
| People | Just you | Up to 10 | Up to 10 |
| Price | Free | $50/month | $150/month |

A 14-day trial covers one server with Team's features, acting on runs, MCP, and your team included, and needs no credit card. See [Free and Paid](/overview/console-monitoring#free-and-paid) and [pricing](https://dagu.sh/pricing).

## Private Deployment

Organizations that cannot connect to Dagu Cloud, or that want the control plane inside their own network, can have it deployed there. This is available on request under an Enterprise agreement. See [Private Control Plane](/server-admin/deployment/closed-network#private-control-plane).

## Related Pages

- [Monitoring](/overview/console-monitoring)
- [Alerts and Email](/overview/console-monitoring-alerts)
- [Console Pages](/overview/console-monitoring-pages)
- [Remote Access from Dagu Cloud](/overview/cloud-remote-access)
- [Dagu Console Members](/overview/console-members)
- [Dagu Console Account](/overview/console-account)
- [Self-hosted Plan Comparison](/overview/self-host-license)
- [Security](/overview/security)
