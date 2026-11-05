# MCP Quickstart

This guide connects an MCP client to your Dagu servers through Dagu Cloud. To connect a client to one server's own endpoint instead, see [Connect Directly to a Server](#connect-directly-to-a-server).

## 1. Connect the Server

The workspace needs the Team or Pro plan, or a trial.

1. Connect the server to Dagu Console: approve it from **Plan & features** in Dagu, run `dagu license activate`, or start it with a server key. See [Connect a Server](/overview/self-host-license#connect-a-server).
2. Turn on monitoring so the server reports its health and runs. Clients read these from Dagu Cloud, even while the server is offline. See [Turn It On](/overview/console-monitoring#turn-it-on).

## 2. Turn On Remote Access

Live calls read logs, control runs, and change DAGs on the server itself. To allow them, open **Plan & features** in Dagu as an administrator, select **Turn on** in the **Remote access** section, and choose the highest level any call gets:

| Level | A call may |
| --- | --- |
| `viewer` | Read DAGs, runs, and logs. |
| `operator` | Also start, enqueue, retry, and stop runs of existing DAGs. |
| `developer` | Also change DAG definitions and run inline specs, which run commands on the host. |

Skip this step to give clients only what the server reports to Dagu Cloud. See [Remote Access from Dagu Cloud](/overview/cloud-remote-access).

## 3. Add the URL to the Client

```text
https://console.dagu.sh/mcp
```

| Client | Setup |
| --- | --- |
| Claude Code | `claude mcp add --transport http dagu https://console.dagu.sh/mcp` |
| Claude (claude.ai, Desktop, and mobile) | Add a custom connector with the URL. |
| ChatGPT | Add a connector with the URL in developer mode. |
| Cursor | Add `{"mcpServers":{"dagu":{"url":"https://console.dagu.sh/mcp"}}}` to `.cursor/mcp.json` or `~/.cursor/mcp.json`. |
| Other clients | Add a remote MCP server over Streamable HTTP with the URL. The client must support OAuth. |

**MCP** in [Dagu Console](https://console.dagu.sh/mcp-access) shows the same URL and steps.

## 4. Sign In and Choose

The client opens Dagu Cloud's sign-in. After you sign in, choose:

- the workspaces the client may reach;
- in each, whether it may read, operate, or edit, on all servers or chosen ones;
- whether it may decide steps that wait for a person.

The connection then appears under **Your connections** on **MCP** in Dagu Console, where you can end it. What a call may do also depends on the workspace's MCP policy, your server role, and each server's level. See [What a Call May Do](/mcp/#what-a-call-may-do).

## 5. First Calls

Ask the client what needs attention. It calls `dagu_read` with its default target, `attention`, which lists runs waiting for a person, open alerts, and failures across the workspace, the most urgent first. Clients that show MCP prompts also offer `dagu_triage` and `dagu_debug_failed_run`.

A live call names its server as `workspace/server`. For DAG and Wiki changes, the client calls `dagu_change` with `mode=preview` before `mode=apply`. See [Through Dagu Cloud](/mcp/tools#through-dagu-cloud).

## Connect Directly to a Server

Each Dagu server also serves MCP at `/mcp` for that one server, authenticated with its own API keys or sign-in.

### Start Dagu

Install Dagu with one of the [installation methods](/getting-started/installation/), then start the HTTP server:

```bash
dagu start-all
```

Set the MCP endpoint URL for the server:

```bash
export DAGU_MCP_URL=http://localhost:8080/mcp
```

Use `localhost` only when the MCP client and Dagu server run on the same machine.

| Server setup | MCP URL |
|--------------|---------|
| Same-machine local server | `http://localhost:8080/mcp` |
| Same-machine custom port | `http://localhost:<port>/mcp` |
| Remote or shared server | `https://dagu.example.com/mcp` |
| Server base path such as `/dagu` | `https://dagu.example.com/dagu/mcp` |

### Add Authentication

If Dagu uses `builtin` authentication, create an [API key](/server-admin/authentication/api-keys) and export it before launching the MCP client:

```bash
export DAGU_MCP_API_KEY=dagu_...
```

For most self-hosted MCP clients, API keys are the recommended setup. Use a role that matches what the client should do: `viewer` is enough for read-only inspection, `operator` can run and stop workflows, and `developer` can create or edit workflows.

For shared teams, prefer individual keys when you need per-user auditability.

### Connect a Client

In your MCP client, add an HTTP or Streamable HTTP MCP server:

| Field | Value |
|-------|-------|
| Name | `dagu` |
| URL | `$DAGU_MCP_URL` |
| Auth | `Authorization: Bearer $DAGU_MCP_API_KEY` when Dagu authentication is enabled |

For specific client commands, see [Clients](/mcp/clients/).

### First Operations

After the client connects, verify the three core tools are available:

- `dagu_read`
- `dagu_change`
- `dagu_execute`

A good first read is the built-in authoring reference:

```text
dagu://reference/authoring
```

For workflow edits, call `dagu_change` with `mode=preview` before `mode=apply`. For run control, call `dagu_execute`, then read the returned run and log resources.
