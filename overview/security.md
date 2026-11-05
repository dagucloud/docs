---
description: What a self-hosted Dagu server sends to Dagu Cloud, what Dagu Cloud keeps and for how long, how remote calls are checked, and where Dagu Cloud runs.
---

# Dagu Cloud: Security and Data Flow

Workflows run only on your servers and their workers. Dagu contains no telemetry: a server talks to Dagu Cloud only once you connect it to [Dagu Console](https://console.dagu.sh), and each feature below stays off until an administrator of the server turns it on. Servers that must never connect use an [offline license](/overview/self-host-license#air-gapped-servers).

- **Nothing connects in.** Every connection is opened by your server, over outbound HTTPS. No inbound port, public address, or tunnel is needed.
- **Your server sets the limit.** Dagu Cloud cannot turn a feature on or raise what it allows.
- **Full logs stay home.** Dagu Cloud never stores full logs, outputs, parameters, or secret values. Monitoring stores failed steps' error messages only at the level that names them.

## Connections

Each connection below is opened by the Dagu server, over outbound HTTPS.

### License check-in

For servers you connect to Dagu Console. `dagu server` or `dagu start-all` checks in with `console.dagu.sh`.

- **Sent**: the license and server IDs, the server's name, its Dagu version, and a heartbeat secret.
- **Kept**: the server's record, with the secret only as a hash. A disconnected server is marked inactive.

### Monitoring

Off until you choose a level. The process that holds the license reports to `console.dagu.sh`. See [Monitoring](/overview/console-monitoring).

- **Sent**: health, and at the level you choose, run status and failed steps' error messages. See [What Is Sent](/overview/console-monitoring#what-is-sent).
- **Kept**: runs for 30 days, daily totals for 13 months, and resolved alerts for 90 days. A server silent for 30 days is deleted with what it reported.
- Alert emails and chat messages carry the workflow, server, run ID, and failed steps, and at the error-message level the end of the first error. Emails come from `no-reply@dagu.sh`.

### Public webhook URLs

Off until you give a webhook a public URL. The scheduler holding the scheduler lock keeps a WebSocket to `relay.dagu.sh`. See [Public Webhook URLs](/server-admin/authentication/public-webhook-urls).

- **Sent**: the server's name and version, the URLs it serves, and each delivery's outcome.
- **Kept**: each request's body and headers, without credentials, until the server takes it, at most 7 days. Each URL's token is kept only as its SHA-256.

### Remote access

Off until an administrator turns it on. Each `dagu server` or `dagu start-all` process keeps a WebSocket to `relay.dagu.sh`. See [Remote Access from Dagu Cloud](/overview/cloud-remote-access).

- **Sent**: answers to the calls MCP clients make, within the server's level. Dagu Cloud passes them on without storing them.
- **Kept**: a log of each call for 90 days: tool, action, subject, outcome, user, and app, plus up to 300 characters of the error when a call fails.

### Upgrade check and tracing

- `dagu upgrade` checks GitHub for a release, only when you run it.
- Traces go only to your own [OpenTelemetry collector](/server-admin/opentelemetry), only if you configure one.

## Firewall

Allow outbound HTTPS (port 443) for the features you use. Workers need nothing.

| Feature | Opened by | Host |
| --- | --- | --- |
| License check-in, monitoring | `dagu server` or `dagu start-all` | `console.dagu.sh` |
| Public webhook URLs | The scheduler holding the scheduler lock | `console.dagu.sh`, `relay.dagu.sh` |
| Remote access | Each process that serves the web UI | `console.dagu.sh`, `relay.dagu.sh` |

`hooks.dagu.sh` is where webhook senders post; your server never contacts it.

## How a Remote Call Is Checked

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-call-portrait.svg" width="480" height="690">
  <img src="/mcp/mcp-call.svg" width="720" height="520" alt="1: the MCP client sends a tool call with its token. 2: Dagu Console checks the four limits. 3: it signs the call for one request and one server, valid for at most a minute. 4: the relay forwards it over the server's WebSocket. 5 to 7: the server verifies the signature, applies its level and runs the tool, and writes its audit log. 8: the answer returns, and Dagu Cloud does not store it." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

- **Dagu Cloud signs each call.** It first checks what the connection may do (below), then signs the call with its Ed25519 key. The signature names the user, their role, and the MCP client, lasts one minute, is accepted once, and covers the exact request.
- **The relay passes it on.** It holds no signing key, so it cannot make a call your server accepts, and a call changed on the way fails the server's check.
- **Your server decides.** It verifies the signature with Dagu Cloud's public key and refuses a call that is expired, reused, or made for another server or request. It runs the call as `cloud:` and the user's ID, with the lower of the signed role and the server's own level, and never as `manager` or `admin`.
- **Calls reach only the MCP tools**: never the terminal, users, API keys, the license, or the remote access settings. Each call is in the server's [audit log](/mcp/auditability#calls-from-dagu-cloud).

## What an MCP Client May Do

An MCP client connected to Dagu Cloud reads what servers reported and, where remote access is on, calls the servers themselves. A call gets the lowest of four limits:

- **The connection**: the workspaces, servers, and access (read, operate, or edit) chosen when the client was connected.
- **The workspace's MCP policy**, set by its owners in Dagu Console.
- **The member's role on the workspace's servers**, set by its owners.
- **The server's remote access [level](/overview/cloud-remote-access#levels)**, set by the server's administrator, for calls to the server itself.

Deciding a step that waits for a person also needs approvals allowed by the connection, the MCP policy, and the server. Owners see every connection to their workspace and its calls, and can end any connection. Members can end their own, and leaving a workspace ends a member's access to it. See [MCP](/mcp/#security).

## What You Trust Dagu Cloud With

- **Answers in transit.** The relay runs on Cloudflare and terminates TLS, so answers to remote calls, which can include logs at the levels you allow, pass through it in memory. This is the trust any hosted tunnel asks, such as Cloudflare Tunnel. Dagu Cloud does not store answers.
- **Signing calls.** Whoever controlled Dagu Cloud could make calls to servers with remote access on, up to each server's level. Each server keeps the final say: remote access is off until its administrator turns it on, the administrator sets the highest level and whether approvals are allowed, turning it off closes the connection at once, and every call is in the server's own audit log.
- **Monitoring and webhooks.** Dagu Console never connects to a server and never runs a workflow. A public webhook URL starts only its own DAG, and once you [choose its sender](/server-admin/authentication/public-webhook-urls#choose-the-sender), only for requests with that sender's valid signature.

## AI Providers

When an MCP client reads a run or its logs through Dagu Cloud, the answer goes to the client and to its provider, such as Anthropic or OpenAI, under that provider's terms. Every level, viewer included, can read logs. Choose each server's level and the workspace's MCP policy with that in mind.

## Where Dagu Cloud Runs

- **Dagu Console and its database**: Google Cloud, `us-central1` (United States), encrypted at rest. Each workspace's data is kept apart by row-level security in the database.
- **Relay and waiting webhook requests**: Cloudflare Workers and Durable Objects.
- **Sign-in**: Auth0. **Email**: Resend. **Payments**: Stripe.

See the [Privacy Policy](https://dagu.sh/privacy) for how personal data is handled.

## Reporting a Vulnerability

Email `company@descarty.com` with a subject such as `Security report: Dagu`, or use GitHub's private vulnerability reporting for `dagucloud/dagu`. Please do not open a public issue. See the [security policy](https://github.com/dagucloud/dagu/security/policy).

## Related Pages

- [Monitoring](/overview/console-monitoring)
- [Public Webhook URLs](/server-admin/authentication/public-webhook-urls)
- [Remote Access from Dagu Cloud](/overview/cloud-remote-access)
- [Architecture](/overview/architecture)
- [Self-hosted Plan Comparison](/overview/self-host-license)
