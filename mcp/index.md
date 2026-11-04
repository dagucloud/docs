# MCP

Dagu includes a built-in Model Context Protocol (MCP) server. There is no separate Dagu MCP package to install: run the Dagu HTTP server and point an MCP client at the `/mcp` endpoint.

Use MCP when an AI tool should operate a running Dagu server: inspect workflows, maintain Dagu's built-in Wiki pages, read run state, preview changes, apply DAG or Wiki page edits, or control DAG runs through the same authenticated server boundary as the REST API.

## What Dagu Exposes

The MCP server is intentionally compact:

| Surface | Purpose |
|---------|---------|
| Tools | `dagu_read`, `dagu_change`, and `dagu_execute` cover reading state, maintaining Wiki pages and DAG YAML, and controlling runs. |
| Resources | `dagu://...` resources expose DAG specs, Wiki pages, run details, run logs, and built-in MCP references. |
| Prompts | Built-in prompts guide DAG and Wiki page authoring and editing, plus failed-run debugging. |
| Audit events | MCP requests, tool calls, subscriptions, and downstream DAG actions are audit-attributed to the accepted credential. |

The server uses Streamable HTTP. The default local URL is:

```text
http://localhost:8080/mcp
```

If the Dagu server uses a base path, place `/mcp` under that base path. For example, a server mounted at `/dagu` exposes MCP at `/dagu/mcp`.

## Common Flows

| Goal | Start here |
|------|------------|
| Connect a client for the first time | [Quickstart](/mcp/quickstart) |
| Configure Claude Code, Codex, Cursor, VS Code, or another client | [Clients](/mcp/clients/) |
| Understand the request path and audit flow | [Architecture](/mcp/architecture) |
| Choose API key, role, surface, and attribution settings | [Authentication](/mcp/authentication) |
| Let AI apps connected to Dagu Cloud use a server with no public address | [Remote Access from Dagu Cloud](/overview/cloud-remote-access) |
| Read or mutate Dagu through MCP tools | [Tools](/mcp/tools) |
| Use `dagu://` resources or run-completion subscriptions | [Resources](/mcp/resources) |
| Review what appears in audit logs | [Auditability](/mcp/auditability) |

## Skill vs MCP

The Dagu skill and the Dagu MCP server solve related but different problems.

| Integration | Configure | Best for |
|-------------|-----------|----------|
| [Dagu skill](/ai/skills) | `gh skill install dagucloud/dagu dagu --scope user` | Teaching AI coding tools how to write valid Dagu workflow YAML. |
| Dagu MCP server | `http://localhost:8080/mcp` | Letting MCP clients read Dagu state and Wiki pages, apply scoped DAG or Wiki page edits, and control runs. |

Most AI-assisted workflow authoring setups benefit from both: install the skill for authoring guidance, then connect MCP when the tool should operate a running Dagu server.
