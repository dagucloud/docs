# MCP Server

Dagu includes a built-in Model Context Protocol (MCP) server. There is no separate Dagu MCP package to install: run the Dagu HTTP server and point your MCP client at the `/mcp` endpoint.

Use the MCP server when you want an MCP-capable AI tool to inspect Dagu state, edit workflow definitions, or control DAG runs through Dagu's authenticated API.

## Quick setup

1. Install Dagu with one of the [installation methods](/getting-started/installation/).
2. Start the server:

```bash
dagu start-all
```

3. In your MCP client, add an HTTP or Streamable HTTP MCP server with these values:

| Field | Value |
|-------|-------|
| Name | `dagu` |
| URL | `http://localhost:8080/mcp` |
| Auth | Use `Authorization: Bearer <token>` when Dagu authentication is enabled |

If you changed Dagu's server base path, append `/mcp` under that base path instead.

## Authentication

The MCP endpoint uses the same authentication mode as the Dagu server.

| Dagu auth mode | MCP client setup |
|----------------|------------------|
| `none` | No token is required. |
| `builtin` | Create an [API key](/server-admin/authentication/api-keys) and send it as `Authorization: Bearer dagu_...`. A login JWT also works, but API keys are better for tools and automation. |
| `basic` | Use HTTP Basic authentication if your MCP client supports it. |

Prefer an `Authorization` header. If a client cannot send headers, Dagu also accepts `?token=<token>` on stream endpoints, but headers are safer for shared or proxied environments.

## Tool surface

Dagu intentionally exposes a compact MCP surface:

| Tool | Use it for |
|------|------------|
| `dagu_read` | Read DAG lists, DAG details, DAG specs, DAG-run details, logs, and MCP reference resources. |
| `dagu_change` | Preview and apply DAG YAML upserts. Use `mode=preview` before `mode=apply`. |
| `dagu_execute` | Start, enqueue, retry, or stop DAG runs. |

The server also exposes resources such as `dagu://dags/{name}/spec`, `dagu://runs/{name}/{dagRunId}`, and `dagu://runs/{name}/{dagRunId}/logs`. MCP clients that support resource subscriptions can subscribe to a run resource and receive an update when the run reaches a terminal state.

## Skill vs MCP

The Dagu skill and the Dagu MCP server solve related but different problems.

| Integration | Install or configure | Best for |
|-------------|----------------------|----------|
| Dagu skill | `gh skill install dagucloud/dagu dagu` | Teaching AI coding tools how to write valid Dagu workflow YAML. |
| Dagu MCP server | `http://localhost:8080/mcp` | Letting MCP clients read Dagu state, validate or apply DAG edits, and control runs. |

Most AI-assisted workflow authoring setups benefit from both: install the skill for authoring guidance, then connect MCP when the tool should operate a running Dagu server.

## Troubleshooting

- **404 or connection refused**: confirm `dagu start-all` is running and the MCP URL matches your server address and base path.
- **401 unauthorized**: add an API key or login token as `Authorization: Bearer <token>`.
- **Client shows no tools**: configure Dagu as an HTTP or Streamable HTTP MCP server, not a stdio command.
- **Remote server access**: expose the Dagu server through your normal secure route, use HTTPS, and give the MCP client a least-privilege API key.

## See also

- [AI Agent](/getting-started/ai-agent) — built-in Steward and workflow agent steps
- [CLI Commands](/getting-started/cli) — command reference, including external AI tool integration
- [API Keys](/server-admin/authentication/api-keys) — bearer tokens for programmatic access
