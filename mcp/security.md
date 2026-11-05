---
description: "How MCP access through Dagu Cloud is authenticated, authorized, verified, and audited, and what data it exposes and stores."
---

# MCP Security Model

This page describes MCP access through Dagu Cloud's endpoint, `https://console.dagu.sh/mcp`: how calls are authenticated, authorized, verified, and audited, and what data they expose and what Dagu Cloud stores. For every connection a Dagu server makes, see [Dagu Cloud: Security and Data Flow](/overview/security).

## Components

| Component | Operated by | Role | Holds |
| --- | --- | --- | --- |
| MCP client | You, or the client's vendor | Sends tool calls on behalf of one person | That person's OAuth tokens for Dagu Cloud |
| Model provider | The client's vendor, such as Anthropic or OpenAI | Receives tool results as model input | Whatever the client reads |
| Dagu Console, `console.dagu.sh` | Dagu Cloud | OAuth authorization server and MCP server. Checks access and signs calls to servers. | Connections, the call log, and data servers report |
| Relay, `relay.dagu.sh` | Dagu Cloud, on Cloudflare | Carries calls and answers between Dagu Console and servers | No signing key. Answers pass through in memory. |
| Dagu server | You | Verifies each call, applies its own remote access level, runs the call, and writes its audit log | Workflows, logs, secrets, and the audit log |

## Authentication

- MCP clients authenticate to Dagu Cloud with OAuth 2.1, using the authorization code flow with PKCE. Dagu servers never receive a token from the client.
- Access tokens are signed JWTs valid for one hour. Refresh tokens rotate on each use and expire after 90 days without use.
- A connection belongs to one person, who must be a member of each workspace it reaches. Every call runs as that person.
- People can turn on two-factor authentication for their Dagu Console account. See [Dagu Console Account](/overview/console-account).
- A connection ends when it is revoked, when its refresh token expires, or when it no longer reaches any workspace.

## Authorization

A call gets the lowest of four limits: the connection's grant, the workspace's MCP policy, the member's server role, and the server's remote access level. See [What a Call May Do](/mcp/#what-a-call-may-do) for who sets each one and its default.

- Dagu Cloud evaluates the grant, the MCP policy, the member's server role and membership, and the workspace's plan on every request. A change applies to the next request.
- The tools a connection is offered follow its highest access in any workspace: `dagu_execute` from operate, and `dagu_change` from edit.
- The server's remote access level applies to calls that reach the server. Reads of data the server reported to Dagu Cloud are limited by the other three limits only.
- The server applies its own level to each call it receives and maps the call to a Dagu role no higher than `developer`. Calls reach only its MCP handler, not the terminal, users, API keys, the license, or the remote access settings.
- Deciding a step that waits for a person requires approvals at the connection, the MCP policy, and the server, and the `attemptId` of the run the decision is based on.
- Edit allows changing DAG definitions and starting inline specs. DAG steps run commands as the OS user Dagu runs as, so a server at `developer` lets each person it reaches run commands on that host.

## Call Verification

```text
MCP client ──▶ console.dagu.sh   evaluates the four limits, signs the call
                    │
                    ▼
               relay.dagu.sh     forwards the call; holds no signing key
                    ▲
                    │ WebSocket, opened by the server
                    │
               Dagu server       verifies the signature, applies its level, runs, audits
```

- Dagu Console signs each call to a server with an Ed25519 key. The signed assertion names the person, their role, the MCP client, the Dagu Cloud workspace, and the target server. It contains a SHA-256 digest of the call's method, path, and body, and expires at most one minute after it is issued.
- The server verifies the assertion with a public key built into the Dagu binary, and accepts each assertion once. It refuses an expired, reused, altered, or misdirected call before running anything.
- The relay cannot produce an assertion that a server accepts.

## Data Exposure

### Readable by a Client

| Source | Data | Requires |
| --- | --- | --- |
| Dagu Cloud | Server health, run status, failed step names, and alerts with their history. At the `errors` [monitoring level](/overview/console-monitoring#turn-it-on), the error messages of failed steps. | Monitoring on the server |
| The server | Run details, full step logs, DAG definitions, and Wiki pages | Remote access at `viewer` or above |

Values of declared secrets are masked in logs and error messages. Other output of a step, such as hosts, paths, or data it prints, is not masked.

### Sent to Model Providers

Tool results are model input. The client sends them to its model provider, such as Anthropic or OpenAI, under that provider's terms, and Dagu Cloud has no control over their retention. Every level, `viewer` included, can read logs. To keep a server's logs and error messages from reaching a provider, leave its remote access off and its monitoring level below `errors`.

### Stored by Dagu Cloud

| Data | Retention |
| --- | --- |
| Answers from servers | Not stored. Passed through in memory. |
| Call log: tool, action, subject, outcome, person, client, and up to 300 characters of an error | 90 days |
| Connections: person, client name, workspaces, and access | Until the connection ends, then 7 days |
| Data servers report | Runs 30 days, daily totals 13 months, resolved alerts 90 days. See [Retention and Limits](/overview/console-monitoring#retention-and-limits). |

Dagu Console and its database run on Google Cloud in `us-central1`, encrypted at rest. Each workspace's rows are separated by row-level security. The relay runs on Cloudflare. See [Where Dagu Cloud Runs](/overview/security#where-dagu-cloud-runs).

## Audit

- The server writes each call it receives to its audit log with credential type `cloud`, the person's email, the client's name, the Dagu Cloud workspace, and the outcome. The log is kept on the server. See [Calls From Dagu Cloud](/mcp/auditability#calls-from-dagu-cloud).
- **Calls from Dagu Cloud** on **MCP** in Dagu Console lists every call in the workspace for 90 days. This includes reads answered from reported data, which do not reach a server, and members' actions from Dagu Console. Workspace owners can view it.
- Workspace owners can view every connection to the workspace. The MCP policy shows who last changed it and when.

## Network

| Host | Opened by | Used for |
| --- | --- | --- |
| `console.dagu.sh` | `dagu server` or `dagu start-all` | License check-in, monitoring reports, and tickets for the relay connection |
| `relay.dagu.sh` | Each process that serves the web UI, while remote access is on | Calls from Dagu Cloud |

- Connections use outbound HTTPS on port 443. Servers open no inbound port.
- Dagu uses the `HTTPS_PROXY` and `NO_PROXY` environment variables for these connections.
- MCP clients connect to `console.dagu.sh` only.

See [Firewall](/overview/security#firewall) for every host Dagu can contact.

## Revoking Access

| Scope | Who | How | Applies |
| --- | --- | --- | --- |
| One connection | The person who made it, or a workspace owner | **End** on **MCP** in Dagu Console | Next request |
| Every MCP client in a workspace | A workspace owner | Set the MCP policy to **Nothing: MCP is off** | Next request |
| One member | A workspace owner | Remove the member from the workspace | Next request |
| Calls to one server | The server's administrator | Turn remote access off | Immediately. Calls in progress end. |
| Reported data from one server | The server's administrator | Lower or turn off monitoring | Next report. Stored data expires on its schedule. |

## Related Pages

- [Dagu Cloud: Security and Data Flow](/overview/security)
- [Remote Access from Dagu Cloud](/overview/cloud-remote-access)
- [MCP Auditability](/mcp/auditability)
- [Reporting a Vulnerability](/overview/security#reporting-a-vulnerability)
- Subprocessors and data processing agreements: https://dagu.sh/trust
