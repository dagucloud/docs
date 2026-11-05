---
description: Let MCP clients connected to Dagu Cloud, and members in Dagu Console, read logs and act on runs of a self-hosted server over a connection the server opens. Off by default; the server caps the role.
---

# Remote Access from Dagu Cloud

MCP clients connected to [Dagu Cloud](https://console.dagu.sh), such as Claude and ChatGPT, can call a self-hosted server's [MCP tools](/mcp/tools) while remote access is on, and members can [act on runs from Dagu Console](#act-on-runs-from-dagu-console). Dagu Cloud carries each call over a connection the server opens, so the server needs no public address, open port, or API key. Without remote access, MCP clients still read what the server reports to Dagu Cloud. See [MCP](/mcp/).

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-architecture-portrait.svg" width="480" height="790">
  <img src="/mcp/mcp-architecture.svg" width="720" height="500" alt="An MCP client connects to Dagu Console at console.dagu.sh with OAuth. Dagu Console sends signed calls through the relay at relay.dagu.sh to Dagu servers over a WebSocket each server opens, and servers report to Dagu Console. Servers accept no inbound connections." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

- Remote access is off until an administrator of the server turns it on. Dagu Cloud cannot turn it on or raise it.
- The server sets the highest role a call gets. Each user gets the lower of that role and the one Dagu Cloud grants them.
- Calls reach only the MCP tools. They never reach the terminal, users, API keys, the license, or the remote access settings.
- Deciding steps that wait for a person is a separate switch, also off by default.

## Requirements

- Dagu v2.22 or later.
- The server is connected to Dagu Console with a license that checks in. See [Connect a Server](/overview/self-host-license#connect-a-server). Servers with offline licenses cannot use remote access.
- The workspace is on the Team or Pro plan, or in a trial. Dagu Cloud refuses the connection for a workspace without a plan, including one on free monitoring.
- `dagu server` or `dagu start-all`. Each process that serves the web UI holds its own connection.
- Outbound HTTPS to `console.dagu.sh` and `relay.dagu.sh`. No inbound port is opened.

## Turn It On

### From the web UI

1. Open **Plan & features** as an administrator and select **Turn on** in the **Remote access** section.
2. Choose **Viewer**, **Operator**, or **Developer**. The dialog lists what each allows.
3. Select **Turn on**.
4. To let calls decide waiting steps, turn on the **Approvals** switch. See [Approvals](#approvals).

The **Remote access** section shows:

- **Access**: the level, with **Change** and **Turn off**.
- **Approvals**: whether calls may approve, reject, or push back steps waiting for a person.
- **Connection**: **Connected**, **Connecting…**, or why the connection failed or Dagu Cloud refused it, such as a workspace without a plan.
- **Agent activity**: on a server with audit logs, the latest calls from Dagu Cloud, with the tool, action, resource, and user, and whether a call failed or was denied.

A change applies at once, without a restart, and is kept in the data directory (`cloud/access-settings.json` under `paths.data_dir`). Other processes that share the data directory apply it within a few seconds. Turning remote access off closes the connection and ends the calls in flight.

### In configuration

For servers managed as code, set the level and the approvals switch in the [configuration file](/server-admin/reference#configuration-file):

```yaml
cloud:
  remote_access: operator   # off, viewer, operator, or developer
  remote_approvals: false
```

or with `DAGU_CLOUD_REMOTE_ACCESS=operator` and `DAGU_CLOUD_REMOTE_APPROVALS=false`.

Each key, when set, wins over the choice in the web UI, `off` and `false` included. The section shows **Set in configuration** for it and offers no way to change it. To change it, change the configuration and restart Dagu. A key left unset is chosen in the web UI, where it starts off.

## Connect an MCP Client

Add Dagu Cloud's MCP server URL to the MCP client as a custom connector:

```text
https://console.dagu.sh/mcp
```

1. Add the URL in Claude, ChatGPT, Cursor, or another client that connects to remote MCP servers. **MCP** in [Dagu Console](https://console.dagu.sh/mcp-access) shows the URL and the steps for each client.
2. Sign in to Dagu Cloud when the client asks. Choose the workspaces the client may reach, what it may do in each (read, operate, or edit), on all servers or chosen ones, and whether it may decide steps waiting for a person.

A call gets the lowest of:

- what the connection was granted in step 2;
- the workspace's **MCP policy**, which its owners set on **MCP**;
- the member's entry under **Server roles**, also set by owners;
- the server's remote access [level](#levels).

Owners see every connection to their workspace on **MCP** and can end any of them.

## Act on Runs from Dagu Console

With remote access on, a member acts on the server's runs from Dagu Console's pages, through the same connection and checks:

- A run's page reads a failed step's log from the server on **View log**. The log is shown, not kept.
- **Retry** retries a finished run, and **Stop** stops one in progress.
- A run waiting for a person shows the step it waits at and what its approval gate asks for, with **Approve** and **Reject**. A task with a form, or a wait inside a sub-workflow, opens in Dagu. The Overview lists such runs under **Needs attention**.
- A failure alert offers its run's log and **Retry**, and an alert of a run running too long, **Stop**. The alert's **Timeline** keeps who did it.

What a member may do is the lower of their entry under **Server roles** on **MCP** and the server's remote access [level](#levels): reading needs `viewer`, and retrying, stopping, and deciding need `operator`. Deciding also needs [approvals](#approvals) on. A button the member may not use is shown disabled, saying why. These actions need the Team or Pro plan, or a trial. Each one is recorded on the server under the member's email, with **Dagu Console** as the app, and in the workspace's **Calls from Dagu Cloud** on **MCP**.

## Levels

| Level | A call may |
| --- | --- |
| `off` (default) | Nothing. Every call is refused. |
| `viewer` | Read DAGs, runs, and logs. |
| `operator` | Also start, enqueue, retry, and stop runs of existing DAGs, with any parameters those DAGs take. |
| `developer` | Also change DAG definitions and run inline specs. |

Each user gets the lower of this level and the role Dagu Cloud grants them on this server. No level reaches `manager` or `admin`.

The role applies in every workspace on the server. It also applies on a server with `auth.mode: none` or `basic`, which checks no roles for its own users.

::: warning Developer runs any command
DAG steps run commands, so `developer` lets the Dagu Cloud users it reaches run any command on the host, as the OS user Dagu runs as. Choose it only where you would give those users a shell on the host.
:::

## Approvals

With **Approvals** on, a call at `operator` or above can approve, reject, or push back a step that waits for a person, through [`dagu_execute`](/mcp/tools#deciding-waiting-steps).

- Each decision must pass the `attemptId` the caller read from the run, so a decision based on an earlier attempt is refused. A decision without it fails with `invalid_tool_input`.
- With approvals off, decisions fail with `unauthorized`, and nothing changes.

## How Calls Differ

Calls from Dagu Cloud use the same three tools as the server's own [`/mcp` endpoint](/mcp/), with these differences:

- They offer no [resource subscriptions](/mcp/resources#run-subscriptions). To follow a run, pass `wait=true` to `dagu_execute`, or read the run again.
- They use no API key. Each runs as the Dagu Cloud user, recorded as `cloud:` followed by the user's Dagu Cloud ID.
- Step decisions need [approvals](#approvals) on and an `attemptId`.

## Security

See [MCP](/mcp/#security) for how calls are verified, what Dagu Cloud keeps, and how to stop access, and [Dagu Cloud: Security and Data Flow](/overview/security) for every connection a server makes.

When [monitoring](/overview/console-monitoring#health) is on, health reports include the remote access level and whether approvals are on.

## Related Pages

- [MCP](/mcp/)
- [Dagu Cloud: Security and Data Flow](/overview/security)
- [MCP Tools](/mcp/tools)
- [MCP Authentication](/mcp/authentication)
- [MCP Auditability](/mcp/auditability)
- [Connect a Server](/overview/self-host-license#connect-a-server)
- [Monitoring](/overview/console-monitoring)
- [Configuration Reference](/server-admin/reference)
