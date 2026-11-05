---
description: "Security review of MCP through Dagu Cloud: identity, tokens, call limits, signed calls, data kept, AI providers, prompt injection, audit, network, and revocation."
---

# MCP Security Review

This page answers the questions a security review asks about MCP clients that reach Dagu servers through [Dagu Cloud's MCP endpoint](/mcp/). For every connection a Dagu server makes, see [Dagu Cloud: Security and Data Flow](/overview/security).

## Summary

| Question | Answer |
| --- | --- |
| Does anything connect into our network? | No. Each server opens an outbound WebSocket to `relay.dagu.sh`. MCP clients connect to Dagu Cloud, never to your servers. |
| Where do workflows run? | Only on your servers and their workers. |
| Can Dagu Cloud turn on remote access, or raise its level? | No. Only the server's administrator can. |
| Does Dagu Cloud store what servers answer? | No. It keeps a log of each call for 90 days, without the answer. |
| Who is a call attributed to? | The person who connected the client, by email, with the client's name, in the server's audit log. |
| When does revoking access take effect? | On the next call. |
| Does the AI provider see our data? | Yes. What the client reads goes to its model provider. |
| Can an MCP client run arbitrary commands? | Only where every limit allows edit, which needs the server's `developer` level. |

## Identity and Tokens

- MCP clients connect with OAuth 2.1 and PKCE. No API key or other long-lived secret is pasted into the client.
- The person signs in to Dagu Console and must be a member of each workspace the connection reaches. Every call runs as that person.
- Two-factor authentication is set per person. Owners cannot require it for members. See [Dagu Console Account](/overview/console-account).
- Access tokens last one hour. Refresh tokens rotate on each use and lapse after 90 days unused.
- A connection lasts until it is ended, its refresh token lapses, or it reaches no workspace.

## What a Call May Do

Each call gets the lowest of four limits: the connection, the workspace's MCP policy, the member's server role, and the server's remote access level. See [What a Call May Do](/mcp/#what-a-call-may-do).

- Dagu Cloud reads the connection, the MCP policy, the member's server role and membership, and the workspace's plan on every call. Ending a connection, lowering the policy or a role, or removing a member applies on the next call.
- A connection is offered only the tools its access allows. A connection that may only read is offered no `dagu_execute` or `dagu_change`.
- The server applies its own level again to each live call and never grants `manager` or `admin`. Calls reach only the MCP tools: never the terminal, users, API keys, the license, or the remote access settings.
- Deciding a step that waits for a person needs approvals at the connection, the MCP policy, and the server, and the `attemptId` of the read the decision rests on. A decision about an earlier attempt is refused.
- Edit lets a client change DAG definitions. DAG steps run commands as the OS user Dagu runs as, so the server's `developer` level is equivalent to a shell on the host for the people it reaches.

## How a Live Call Is Verified

```text
MCP client ──▶ console.dagu.sh   checks the four limits, signs the call
                    │
                    ▼
               relay.dagu.sh     passes it on; holds no signing key
                    ▲
                    │ WebSocket, opened by the server
                    │
               Dagu server       verifies the signature, applies its level, runs, audits
```

- Dagu Cloud signs each call with Ed25519. The signature names the person, the role, the MCP client, and the Dagu Cloud workspace. It covers the call's method, path, and body, lasts at most one minute, and is accepted once.
- The server verifies it with Dagu Cloud's public key, which is built into the Dagu binary. Nothing is fetched at run time. A call that is expired, reused, altered, or made for another server is refused, and nothing runs.
- The relay cannot make a call a server accepts, and a call changed on the way fails the check.
- Dagu Cloud signs licenses with the same key. Each signature names its use, so a license cannot pass as a call.

## Data

### What a Client Can Read

| Source | What | Needs |
| --- | --- | --- |
| Dagu Cloud | Server health, run status, failed step names, and alerts with what people did about them. At the `errors` [monitoring level](/overview/console-monitoring#turn-it-on), the error messages of failed steps. | Monitoring on the server |
| The server, live | Run details, full step logs, DAG definitions, and Wiki pages | Remote access `viewer` or above |

Values of declared secrets are masked in logs and error messages. Other text a step prints, such as hosts, paths, or data, is not masked.

### What Reaches the AI Provider

Everything a client reads goes to the client and to its model provider, such as Anthropic or OpenAI, under that provider's terms. Every level, `viewer` included, can read logs. For a server whose logs must not leave, keep remote access off and its monitoring level below `errors`.

### What Dagu Cloud Keeps

| Data | Kept |
| --- | --- |
| Answers from servers to live calls | Not stored. Passed on in memory. |
| Call log: tool, action, subject, outcome, person, client, and up to 300 characters of an error | 90 days |
| Connections: person, client name, workspaces, access, last use | Until ended, lapsed, or reaching no workspace, then 7 days |
| What servers report | Runs 30 days, daily totals 13 months, resolved alerts 90 days. See [Retention and Limits](/overview/console-monitoring#retention-and-limits). |

Dagu Console and its database run on Google Cloud in `us-central1`, encrypted at rest, with each workspace kept apart by row-level security. The relay runs on Cloudflare. See [Where Dagu Cloud Runs](/overview/security#where-dagu-cloud-runs).

## Prompt Injection

Text from servers reaches the model as tool output: logs, error messages, alert text, DAG definitions, and Wiki pages. Anyone who can make a step print text, or edit a DAG or a Wiki page, can place instructions there. A model may follow them and call tools within the connection's access.

What limits the effect:

- A connection that may only read is offered no tool that acts.
- Dagu Cloud's MCP server tells clients to treat text from servers as data, and marks `dagu_execute` and `dagu_change` as destructive, so clients that confirm destructive tools ask the person first. Both depend on the client and the model.
- Decisions on waiting steps need approvals at every limit and the `attemptId` of the read.
- The server's level caps every live call, and only `developer` reaches commands.

For connections that read untrusted text:

- Grant read unless the client must act.
- Leave approvals off unless the client must decide steps.
- Keep the client's confirmation for tools that act turned on.
- Keep servers that hold sensitive systems below `developer`.

## Audit

- **On the server.** Each live call is in the server's audit log with credential type `cloud`, the person's email, the client's name, the Dagu Cloud workspace, and the outcome. This log stays on your infrastructure. See [Calls From Dagu Cloud](/mcp/auditability#calls-from-dagu-cloud).
- **In Dagu Cloud.** **Calls from Dagu Cloud** on **MCP** lists every call in the workspace for 90 days, including reads of reported data that never reach a server, and members' actions from Dagu Console. Owners see it.
- Owners see every connection to the workspace, and the MCP policy shows who last changed it.

## Network

| Host | Opened by | For |
| --- | --- | --- |
| `console.dagu.sh` | `dagu server` or `dagu start-all` | License check-in, monitoring, and the ticket for the relay connection |
| `relay.dagu.sh` | Each process that serves the web UI, while remote access is on | Live calls |

- Outbound HTTPS on port 443. No inbound port.
- Dagu reads the standard `HTTPS_PROXY` and `NO_PROXY` environment variables for these connections.
- See [Firewall](/overview/security#firewall) for every host Dagu can contact.

## Stopping Access

| To stop | Who | How | Takes effect |
| --- | --- | --- | --- |
| One connection | Its person, or a workspace owner | **End** on **MCP** in Dagu Console | Next call |
| Every MCP client in a workspace | A workspace owner | Set the MCP policy to **Nothing: MCP is off** | Next call |
| One member's clients | A workspace owner | Remove the member from the workspace | Next call |
| Live calls to one server | The server's administrator | Turn remote access off | At once. Calls in flight end. |
| Reported data for one server | The server's administrator | Lower or turn off monitoring | Next report. Kept data ages out. |

## What You Trust Dagu Cloud With

- **Signing.** Whoever controlled Dagu Cloud could sign calls to servers with remote access on, up to each server's level and approvals setting. Those calls still appear in each server's audit log.
- **Answers in transit.** The relay terminates TLS on Cloudflare, so answers pass through it in memory.
- **Availability.** If Dagu Cloud is unavailable, MCP through it stops. Workflows keep running, and each server's own `/mcp` keeps working. See the service targets at https://dagu.sh/sla.

See [What You Trust Dagu Cloud With](/overview/security#what-you-trust-dagu-cloud-with).

## Documents

- Subprocessors, release verification, and vulnerability handling: https://dagu.sh/trust
- A data processing agreement is available on request from `company@descarty.com`.
- [Privacy Policy](https://dagu.sh/privacy) and [Terms of Service](https://dagu.sh/terms).
- To report a vulnerability, see [Reporting a Vulnerability](/overview/security#reporting-a-vulnerability).
