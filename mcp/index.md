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

## Connect

Without a plan or a trial, a client connects read only and reads what the servers report. Reading a server's logs and acting on its runs need the Team or Pro plan, or a trial.

1. **Connect the server** to Dagu Console and turn on monitoring. See [Connect a Server](/overview/self-host-license#connect-a-server) and [Monitoring](/overview/console-monitoring#turn-it-on).
2. **Turn on remote access** in **Plan & features** in Dagu, and choose the highest level calls get: `viewer`, `operator`, or `developer`. Without it, clients only read what the server reports. See [Remote Access from Dagu Cloud](/overview/cloud-remote-access).
3. **Add Dagu Cloud to the client** and sign in. Choose the workspaces it may reach, read, operate, or edit in each, and whether it may decide waiting steps.

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

## Security

| Property | Detail |
| --- | --- |
| **No inbound connections** | Servers connect out to `console.dagu.sh` and `relay.dagu.sh`. Clients never connect to your servers. |
| **Off by default** | Only the server's administrator can turn remote access on or raise its level. |
| **Server sets the ceiling** | Calls run at or below the server's level, reach only the MCP tools, and never get `manager` or `admin`. |
| **Signed per call** | Each call is signed for one request and one server, valid for at most one minute, and accepted once. The relay cannot create or alter a call. |
| **Runs as a person** | Each call runs as the member who connected the client with OAuth. Access tokens expire after one hour. |
| **Nothing kept in Dagu Cloud** | Dagu Cloud stores no answers and no record of calls. It stores only the connection, until it ends. |
| **Recorded in your server's audit log** | Each call that reaches a server is in that server's audit log with the person's email and the client's name. |
| **Revocable** | A change applies to the next request. Turning remote access off closes the connection at once. |

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-call-portrait.svg" width="480" height="690">
  <img src="/mcp/mcp-call.svg" width="720" height="520" alt="1: the MCP client sends a tool call with its token. 2: Dagu Console checks the four limits. 3: it signs the call for one request and one server, valid for at most a minute. 4: the relay forwards it over the server's WebSocket. 5 to 7: the server verifies the signature, applies its level and runs the tool, and writes its audit log. 8: the answer returns, and Dagu Cloud does not store it." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

## Data

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-data-portrait.svg" width="480" height="860">
  <img src="/mcp/mcp-data.svg" width="720" height="470" alt="A Dagu server's reports go to Dagu Console, which stores them. Answers to calls pass through the relay and Dagu Console without being stored. The MCP client passes what it reads to its model provider." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

- Values of declared secrets are masked in logs and error messages.
- What a client reads goes to its model provider, such as Anthropic or OpenAI. Every level can read logs. To keep a server's logs from a provider, leave its remote access off and its monitoring level below `errors`.
- What servers report for monitoring is kept 30 days. See [Retention and Limits](/overview/console-monitoring#retention-and-limits).

## Revoke Access

| To stop | Who | How |
| --- | --- | --- |
| One connection | Its member, or a workspace owner | **End** on **MCP** in Dagu Console |
| All MCP clients in a workspace | A workspace owner | MCP policy: **Nothing: MCP is off** |
| One member | A workspace owner | Remove the member from the workspace |
| Calls to one server | The server's administrator | Turn remote access off |

## Connect Directly to a Server

Each Dagu server also serves MCP at `/mcp` for that one server, authenticated with its own API keys. See the [Quickstart](/mcp/quickstart), [Clients](/mcp/clients/), and [Tools](/mcp/tools).
