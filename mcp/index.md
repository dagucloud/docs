---
description: Connect ChatGPT, Claude, Cursor, and other MCP clients to every Dagu server in a workspace through one Dagu Cloud endpoint. Servers connect out; no inbound port or API key.
---

# MCP

Dagu Cloud gives MCP clients one endpoint for every Dagu server in a workspace:

```text
https://console.dagu.sh/mcp
```

Clients read runs, alerts, and logs across the workspace's servers, and act on them: start, retry, and stop runs, decide steps that wait for a person, and edit DAGs, within the limits below. What servers report to Dagu Cloud stays readable while a server is offline.

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-architecture-portrait.svg" width="480" height="790">
  <img src="/mcp/mcp-architecture.svg" width="720" height="500" alt="An MCP client connects to Dagu Console at console.dagu.sh with OAuth. Dagu Console sends signed calls through the relay at relay.dagu.sh to Dagu servers over a WebSocket each server opens, and servers report to Dagu Console. Servers accept no inbound connections." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

## Before You Connect

- **Nothing is reachable until you turn it on.** Remote access is off on every server until its administrator turns it on. Until then, a client reads only what the administrator chose to report.
- **You choose what a client can reach.** At sign-in, choose its workspaces and servers, and whether it reads, operates, or edits. It decides steps that wait for a person only if you, the workspace's owners, and the server's administrator all allow it.
- **Dagu Cloud stores nothing a client reads from a server.** Answers pass through without being stored, and Dagu Cloud keeps no record of calls.
- **Your model provider receives what the client reads.** [Data](#data) lists what that covers and how to limit it.
- **You can check and stop it.** Each call is in the server's own audit log, and you can end a connection at any time. See [Revoke Access](#revoke-access).

## Connect

Without a plan or a trial, a client connects read only and reads what the servers report. Reading a server's logs and acting on its runs need the Team or Pro plan, or a trial.

1. **Connect the server** to Dagu Console and turn on monitoring. See [Connect a Server](/overview/self-host-license#connect-a-server) and [Monitoring](/overview/console-monitoring#turn-it-on).
2. **Turn on remote access** in **Plan & features** in Dagu, and choose the highest level calls get: `viewer`, `operator`, or `developer`. Without it, clients only read what the server reports. See [Remote Access from Dagu Cloud](/overview/cloud-remote-access).
3. **Add Dagu Cloud to the client** and sign in. Choose which workspaces and servers it may reach, whether it may read, operate, or edit in each workspace, and whether it may decide waiting steps.

**Claude Code, Codex, Cursor, and other coding agents.** Paste this prompt into the agent. It adds Dagu Cloud and starts the sign-in.

```text
Add the Dagu Cloud MCP server to this tool so it works in every project.

URL: https://console.dagu.sh/mcp
Transport: Streamable HTTP
Sign-in: OAuth in the browser. No API key or header.
Name: dagu

When it is added, start the sign-in, or tell me exactly what to run to sign in.
```

**Claude and ChatGPT.** A chat cannot change its own settings, so add Dagu Cloud in the app:

| Client | Steps |
| --- | --- |
| Claude | Open **Customize**, then **Connectors**. Select **+ Add**, then **Add custom connector**. Paste the URL, select **Continue**, and sign in. On Team and Enterprise, an owner adds it first under **Organization settings**, then **Connectors**. |
| ChatGPT | Open [Plugins](https://chatgpt.com/plugins). Select **+**, then **Add custom MCP server**. Paste the URL as the **Server URL**, choose OAuth, confirm, and select **Create as a plugin**. Install the plugin, then sign in. |

**To add it yourself:**

| Client | Setup |
| --- | --- |
| Cursor | [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=dagu&config=eyJ1cmwiOiJodHRwczovL2NvbnNvbGUuZGFndS5zaC9tY3AifQ%3D%3D), or add `{"mcpServers":{"dagu":{"url":"https://console.dagu.sh/mcp"}}}` to `~/.cursor/mcp.json`. |
| Claude Code | `claude mcp add --transport http --scope user dagu https://console.dagu.sh/mcp`, then run `/mcp` in Claude Code to sign in. |
| VS Code | `code --add-mcp '{"name":"dagu","type":"http","url":"https://console.dagu.sh/mcp"}'` |
| Other clients | Add a remote Streamable HTTP server with the URL. The client must support OAuth. |

## What a Call May Do

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-access-portrait.svg" width="480" height="586">
  <img src="/mcp/mcp-access.svg" width="720" height="470" alt="A call gets the lowest of four limits: the connection, the MCP policy, the member's server role, and the server's remote access level. With edit, operate, developer, and viewer, the call may only read." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

| Limit | Set by | Default |
| --- | --- | --- |
| Connection | The member, at sign-in | Chosen at sign-in |
| MCP policy | Workspace owners, on **MCP** in Dagu Console | Read and operate, no approvals |
| Server role | Workspace owners, on **MCP** | `developer` for owners, `viewer` for others |
| Remote access level | The server's administrator | `off` |

The server's level limits calls that reach the server, not reads of what it already reported. Deciding a waiting step also needs approvals at the connection, the MCP policy, and the server.

::: warning Edit runs commands
Edit lets a client change DAGs, and DAG steps run commands on the host. Allow it, and the server's `developer` level, only where you would allow shell access.
:::

## In the Chat

Claude and other clients that support [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) draw Dagu Cloud in the conversation. Ask what needs attention, or for your servers, alerts, runs, or one run. The client calls `dagu_show`, and you work in the view:

- See what needs a person across every server, and move between **Attention**, **Servers**, **Alerts**, **Runs**, and **Workflows**.
- Open a run with its steps and logs, retry it from the start or from a failed step, or stop it.
- In a run with many steps, start from what failed, is running, or waits, then filter or search the rest. Open the items of a foreach step page by page.
- Approve or reject a step that waits for a person, and complete a human task, with the inputs its form asks for.
- Acknowledge or snooze an alert.
- Ask the client to explain a failure. The question goes into the conversation.
- Compare a DAG or Wiki change with what is on the server before you apply it.

The view shows the actions that would work. Where a plan, a limit, or the server's remote access stands in the way, it says so and links to where to change it. What you do in the view reaches the client's model, so it does not repeat your action.

Clients without MCP Apps get the same answers as text. An agent's own lookups use `dagu_read`, which draws nothing.

## Security

| Property | Detail |
| --- | --- |
| **No inbound connections** | Servers connect out to `console.dagu.sh` and `relay.dagu.sh`. Clients never connect to your servers. |
| **Off by default** | Only the server's administrator can turn remote access on or raise its level. |
| **Server sets the ceiling** | Calls run at or below the server's level, reach only the MCP tools, and never get `manager` or `admin`. |
| **Signed per call** | Each call is signed for one request and one server, valid for at most one minute, and accepted once. The relay cannot create or alter a call. |
| **Runs as a person** | Each call runs as the member who connected the client with OAuth. Access tokens expire after one hour. |
| **No answers or call records in Dagu Cloud** | Dagu Cloud stores no answers and no record of calls. For each connection it stores who connected, the client's name, what the connection may reach, and when it was last used, until the connection ends. A connection unused for 90 days ends by itself. |
| **Recorded in your server's audit log** | Each call that reaches a server is in that server's audit log with the person's email and the client's name. Audit logging is on by default and keeps entries for 7 days unless you change it. See [MCP Auditability](/mcp/auditability). |
| **Revocable** | A change applies to the next request. Turning remote access off closes the connection at once. |

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-call-portrait.svg" width="480" height="690">
  <img src="/mcp/mcp-call.svg" width="720" height="520" alt="1: the MCP client sends a tool call with its token. 2: Dagu Console checks the four limits. 3: it signs the call for one request and one server, valid for at most a minute. 4: the relay forwards it over the server's WebSocket. 5 to 7: the server verifies the signature, applies its level and runs the tool, and writes its audit log. 8: the answer returns, and Dagu Cloud does not store it." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

## Data

Dagu Cloud stores what servers report for monitoring, and nothing a client reads from a server. What a client reads goes to its model provider, such as Anthropic or OpenAI, under that provider's terms.

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-data-portrait.svg" width="480" height="860">
  <img src="/mcp/mcp-data.svg" width="720" height="470" alt="A Dagu server's reports go to Dagu Console, which stores them. Answers to calls pass through the relay and Dagu Console without being stored. The MCP client passes what it reads to its model provider." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

| Data | Stored in Dagu Cloud | Reaches the model provider |
| --- | --- | --- |
| Logs, outputs, parameters, and DAG YAML | No. They pass through when a client reads them. | When a client reads them, which needs remote access on |
| Run status, and DAG, queue, and step names | At monitoring level `runs` or `errors` | When a client reads them |
| Failed steps' error messages | At monitoring level `errors` only | When a client reads them |
| Values of declared secrets | No | Masked in logs and error messages |

Finished runs are kept for 30 days. See [Retention and Limits](/overview/console-monitoring#retention-and-limits) for the rest.

### Limit What a Client Sees

| To | Do this |
| --- | --- |
| Keep a server's logs from the model provider | Leave its remote access off and its monitoring level below `errors`. |
| Keep DAG, queue, and step names from it too | Also set the monitoring level to `health`. |
| Limit a client to some servers | At sign-in, choose **Only these servers**. The default is all servers in the workspace, including ones connected later. |
| Let a client only read | Choose **Read** at sign-in. To hold every client on a server to reading, set its level to `viewer`. Every level can read logs. |
| Mask a credential | Load it through [`secrets:`](/writing-workflows/secrets). Values loaded through `env:` or `dotenv:` are not masked. |
| Stop the provider keeping what it reads | Use a client covered by a zero data retention (ZDR) agreement with that provider. ZDR is arranged with the provider, not in Dagu. It limits storage, not processing, and does not cover every client, so check yours. Without it, retention follows your agreement with the provider. |

## Revoke Access

| To stop | Who | How |
| --- | --- | --- |
| One connection | Its member, or a workspace owner | **End** on **MCP** in Dagu Console |
| All MCP clients in a workspace | A workspace owner | MCP policy: **Nothing: MCP is off** |
| One member | A workspace owner | Remove the member from the workspace |
| Calls to one server | The server's administrator | Turn remote access off |

## Connect Directly to a Server

Each Dagu server also serves MCP at `/mcp` for that one server, authenticated with its own API keys. See the [Quickstart](/mcp/quickstart), [Clients](/mcp/clients/), and [Tools](/mcp/tools).
