---
description: Connect ChatGPT, Claude, Cursor, and other MCP clients to every Dagu server in a workspace through one Dagu Cloud endpoint. Servers connect out; no inbound port or API key.
---

# MCP

Dagu Cloud gives MCP clients one endpoint for every Dagu server in a workspace:

```text
https://console.dagu.sh/mcp
```

A person adds the URL to an MCP client such as Claude, ChatGPT, Claude Code, or Cursor, signs in to Dagu Cloud, and chooses what the client may reach. The client can then read runs, alerts, and logs across the workspace's servers, start, retry, or stop runs, decide steps that wait for a person, and edit DAGs, as far as the [limits below](#what-a-call-may-do) allow.

```text
MCP client ──MCP, OAuth──▶ console.dagu.sh ──▶ what servers reported: runs, alerts, health
                                │
                                │ signed call
                                ▼
                           relay.dagu.sh
                                ▲
                                │ WebSocket, opened by the server
                                │
                           Dagu server ──▶ dagu_read, dagu_change, dagu_execute
```

Workflows run only on your servers. Each server opens its own outbound connections, so it needs no public address, open port, or API key.

## What a Client Can Do

Dagu Cloud's MCP server answers from two places.

| From | What a client can do | Needs on the server |
| --- | --- | --- |
| What servers report to Dagu Cloud | See what needs a person, each server's health, runs, and alerts, and how each workflow went. Acknowledge or snooze an alert. Answers while a server is offline. | [Monitoring](/overview/console-monitoring) |
| The server itself, live | Read a run, its logs, DAGs, and Wiki pages. Start, enqueue, retry, and stop runs. Approve, reject, or push back a waiting step. Preview and apply DAG and Wiki changes. | [Remote access](/overview/cloud-remote-access) |

The tools keep the names a Dagu server uses: `dagu_read`, `dagu_execute`, and `dagu_change`. A live call names its server. See [Through Dagu Cloud](/mcp/tools#through-dagu-cloud).

## What a Call May Do

Each call gets the lowest of four limits, read again on every call:

| Limit | Set by | Default |
| --- | --- | --- |
| The connection: its workspaces, its servers, and read, operate, or edit in each | The person, when they sign in from the client | Chosen at sign-in |
| The workspace's **MCP policy** | Workspace owners, on **MCP** in Dagu Console | Read and operate, no approvals |
| The member's **server role** | Workspace owners, on **MCP** | `developer` for owners, `viewer` for everyone else |
| The server's [remote access level](/overview/cloud-remote-access#levels) | The server's administrator | `off` |

The server's level limits live calls. It does not limit reads of what the server already reported to Dagu Cloud; the first three limits do.

Deciding a step that waits for a person also needs approvals allowed by the connection, the MCP policy, and the server. No call gets `manager` or `admin` on a server.

## Security

- **Nothing connects in.** Each server opens an outbound WebSocket to `relay.dagu.sh`. MCP clients connect to Dagu Cloud, never to your servers.
- **Each live call is signed for one request.** Dagu Cloud signs it with Ed25519, for at most a minute, to be accepted once. The relay holds no key, and the server checks the signature with a public key built into the Dagu binary.
- **The server keeps the final say.** Remote access is off until the server's administrator turns it on. Dagu Cloud cannot turn it on or raise it, and turning it off closes the connection at once.
- **Revocation applies on the next call.** Ending a connection or lowering a limit does not wait for a token to expire.
- **Each call is recorded twice**: in the server's own audit log under the person's email, and in the workspace's **Calls from Dagu Cloud** for 90 days.
- **Answers are not stored.** Dagu Cloud passes answers from servers on without keeping them.

See [MCP Security Review](/mcp/security) for identity, tokens, what reaches the AI provider, prompt injection, audit, and how to stop access.

## Requirements

- A workspace on the Team or Pro plan, or in a trial. Free monitoring includes no MCP.
- Servers connected to Dagu Console with a license that checks in. Servers with offline licenses never connect to Dagu Cloud.
- For live calls, Dagu v2.22 or later with remote access on.
- Outbound HTTPS to `console.dagu.sh` and `relay.dagu.sh`.

Start with the [Quickstart](/mcp/quickstart).

## Connect Directly to a Server

Each Dagu server also serves MCP itself at `/mcp`, with the same three tools, for that one server. Use it for local development, for automation that runs next to the server, or for a server that does not connect to Dagu Cloud. It authenticates with the server's API keys or its own sign-in, and the client must reach the server's address.

| Goal | Start here |
| --- | --- |
| Connect to a server's `/mcp` | [Connect Directly to a Server](/mcp/quickstart#connect-directly-to-a-server) |
| Configure Claude Code, Codex, Cursor, VS Code, or another client | [Clients](/mcp/clients/) |
| Choose API key, role, surface, and attribution settings | [Authentication](/mcp/authentication) |
| Understand the request path and audit flow | [Architecture](/mcp/architecture) |
| Use `dagu://` resources or run-completion subscriptions | [Resources](/mcp/resources) |
| Review what appears in audit logs | [Auditability](/mcp/auditability) |

## Skill vs MCP

The Dagu skill and Dagu MCP solve related but different problems.

| Integration | Configure | Best for |
|-------------|-----------|----------|
| [Dagu skill](/ai/skills) | `gh skill install dagucloud/dagu dagu --scope user` | Teaching AI coding tools how to write valid Dagu workflow YAML. |
| Dagu MCP | `https://console.dagu.sh/mcp`, or a server's `/mcp` | Letting MCP clients read Dagu state and Wiki pages, apply scoped DAG or Wiki page edits, and control runs. |

Most AI-assisted workflow authoring setups benefit from both: install the skill for authoring guidance, then connect MCP when the tool should operate your Dagu servers.
