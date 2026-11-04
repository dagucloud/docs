---
description: Let AI apps connected to Dagu Cloud, and members in Dagu Console, read logs and act on runs of a self-hosted server over a connection the server opens. Off by default; the server caps the role.
---

# Remote Access from Dagu Cloud

AI apps connected to [Dagu Cloud](https://console.dagu.sh), such as Claude and ChatGPT, can call a self-hosted server's [MCP tools](/mcp/tools) while remote access is on, and members can [act on runs from Dagu Console](#act-on-runs-from-dagu-console). Dagu Cloud carries each call over a connection the server opens, so the server needs no public address, open port, or API key.

```text
AI app ──MCP──▶ Dagu Cloud ── signed call ──┐
                                            │  WebSocket, opened by the server
                                            ▼
                     Dagu server ──▶ dagu_read, dagu_change, dagu_execute
```

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

## Connect an AI App

Add Dagu Cloud's MCP server URL to the AI app as a custom connector:

```text
https://console.dagu.sh/mcp
```

1. Add the URL in Claude, ChatGPT, Cursor, or another app that connects to remote MCP servers. **MCP** in [Dagu Console](https://console.dagu.sh/ai-apps) shows the URL and the steps for each app.
2. Sign in to Dagu Cloud when the app asks. Choose the workspaces the app may reach, what it may do in each (read, operate, or edit), on all servers or chosen ones, and whether it may decide steps waiting for a person.

A call gets the lowest of:

- what the connection was granted in step 2;
- the workspace's **Agent policy**, which its owners set on **MCP**;
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

- Each call carries an assertion that Dagu Cloud signs for that one request. It names the user, their role, and the AI app, is good for at most a minute, and is accepted once. The server refuses a call whose assertion is invalid, expired, reused, or made for another server or request, and nothing runs.
- Calls reach only the MCP endpoint and never get `manager` or `admin`, so they cannot open the terminal or manage users, API keys, the license, or these settings.
- Turning remote access off closes the connection and ends the calls in flight. Calls that still arrive are refused.
- Audit logs record each call with credential type `cloud`, the user's email, the AI app, and the Dagu Cloud workspace. See [Calls From Dagu Cloud](/mcp/auditability#calls-from-dagu-cloud).
- When [monitoring](/overview/console-monitoring#health) is on, health reports include the remote access level and whether approvals are on.
- Dagu Cloud passes each answer on without storing it. It keeps a log of each call for 90 days: tool, action, subject, outcome, user, and app (**Dagu Console** for a member's own action), plus up to 300 characters of the error when a call fails.
- An answer the AI app receives also reaches the app's provider, such as Anthropic or OpenAI. Every level, viewer included, can read logs.

See [Dagu Cloud: Security and Data Flow](/overview/security) for every connection, what Dagu Cloud keeps, and what it is trusted with.

## Related Pages

- [Dagu Cloud: Security and Data Flow](/overview/security)
- [MCP Tools](/mcp/tools)
- [MCP Authentication](/mcp/authentication)
- [MCP Auditability](/mcp/auditability)
- [Connect a Server](/overview/self-host-license#connect-a-server)
- [Monitoring](/overview/console-monitoring)
- [Configuration Reference](/server-admin/reference)
